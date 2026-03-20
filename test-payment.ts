

import { trackEvent } from './src/services/post-signup-monitor';
import { supabaseAdmin } from './src/lib/supabase';
import { generateId } from './src/lib/utils';
import { MonitorEvent } from './src/types';

async function runTest() {
    console.log("--- Starting Live Payment Monitoring Test ---");
    const badUserId = generateId();
    const cleanUserId = generateId();
    const stolenCardFingerprint = "stripe_hash_evil_999";

    console.log(`1. Creating bad user: ${badUserId}`);
    await supabaseAdmin.from('ts_users').insert([{ id: badUserId, highest_risk_score: 0, last_decision: 'ALLOW' }]);
    
    // Simulate bad user adding a card
    await trackEvent({
        userId: badUserId,
        eventType: 'feature_use',
        timestamp: new Date().toISOString(),
        metadata: {
            payment: { fingerprint: stolenCardFingerprint, bin: "424242", last4: "4242" }
        }
    } as MonitorEvent);

    console.log("2. Marking bad user as revoked...");
    await supabaseAdmin.from('ts_users').update({ is_quarantined: true }).eq('id', badUserId);

    console.log(`3. Simulating clean user ${cleanUserId} adding the exact same card months later`);
    await supabaseAdmin.from('ts_users').insert([{ id: cleanUserId, highest_risk_score: 0, last_decision: 'ALLOW' }]);
    const result = await trackEvent({
        userId: cleanUserId,
        eventType: 'feature_use',
        timestamp: new Date().toISOString(),
        metadata: {
            payment: { fingerprint: stolenCardFingerprint, bin: "424242", last4: "4242" }
        }
    } as MonitorEvent);

    console.log("4. Monitoring Result for Clean User:");
    console.log(JSON.stringify(result, null, 2));

    if (result.action === 'REVOKE') {
        console.log("SUCCESS: User was revoked on the spot due to adding a stolen/revoked card.");
    } else {
        console.log("FAILED: Expected REVOKE action.");
    }
}

runTest().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
