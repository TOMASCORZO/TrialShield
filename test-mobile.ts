import { trackEvent } from './src/services/post-signup-monitor';
import { supabaseAdmin } from './src/lib/supabase';
import { generateId } from './src/lib/utils';
import { MonitorEvent } from './src/types';

async function runTest() {
    console.log("--- Starting Mobile Fingerprint Test ---");
    const badUserId = generateId();
    const cleanUserId = generateId();
    const sharedDeviceId = "IOS-EVIL-001";

    console.log(`1. Creating bad user: ${badUserId}`);
    // Insert into ts_users
    await supabaseAdmin.from('ts_users').insert([{ id: badUserId, highest_risk_score: 0, last_decision: 'ALLOW' }]);
    
    // Simulate bad user login
    await trackEvent({
        userId: badUserId,
        eventType: 'login',
        timestamp: new Date().toISOString(),
        deviceFingerprint: { id: 'dummy', idfv: sharedDeviceId }
    } as MonitorEvent);

    console.log("2. Marking bad user as revoked (quarantined)...");
    await supabaseAdmin.from('ts_users').update({ is_quarantined: true }).eq('id', badUserId);

    console.log(`3. Simulating clean user ${cleanUserId} initiating session with same device ${sharedDeviceId}`);
    const result = await trackEvent({
        userId: cleanUserId,
        eventType: 'feature_use',
        timestamp: new Date().toISOString(),
        deviceFingerprint: { id: 'dummy2', idfv: sharedDeviceId }
    } as MonitorEvent);

    console.log("4. Monitoring Result for Clean User:");
    console.log(JSON.stringify(result, null, 2));

    if (result.action === 'REVOKE') {
        console.log("SUCCESS: User was revoked on the spot due to cross-device detection.");
    } else {
        console.log("FAILED: Expected REVOKE action.");
    }
}

runTest().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
