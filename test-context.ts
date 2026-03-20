import { trackEvent } from './src/services/post-signup-monitor';
import { supabaseAdmin } from './src/lib/supabase';
import { generateId } from './src/lib/utils';
import { MonitorEvent } from './src/types';

async function runTest() {
    console.log("--- Starting Context vs Content Fingerprint Test ---");
    const badUserId = generateId();
    const cleanUserA = generateId(); // Tests Context (GitHub Link) - Expect WARN
    const cleanUserB = generateId(); // Tests Content (Private CSV) - Expect REVOKE

    const sharedGithubRepo = "https://github.com/facebook/react";
    const sharedPrivateFileHash = "a58b9f123abc456";

    console.log(`\n1. Creating Bad User: ${badUserId}`);
    await supabaseAdmin.from('ts_users').insert([{ id: badUserId, highest_risk_score: 0, last_decision: 'ALLOW' }]);
    
    // Simulating bad user activity providing a github repo and uploading a file
    await trackEvent({
        userId: badUserId,
        eventType: 'feature_use',
        timestamp: new Date().toISOString(),
        context: [{ label: 'github_repo', hash: sharedGithubRepo }],
        content: [{ label: 'uploaded_db', hash: sharedPrivateFileHash }]
    } as MonitorEvent);

    console.log("2. Marking Bad User as revoked...");
    await supabaseAdmin.from('ts_users').update({ is_quarantined: true }).eq('id', badUserId);

    console.log(`\n3. Simulating Clean User A (${cleanUserA}) pasting the exact same GitHub Repo (Context)`);
    await supabaseAdmin.from('ts_users').insert([{ id: cleanUserA, highest_risk_score: 0, last_decision: 'ALLOW' }]);
    
    // Testing Context Only
    const resultA = await trackEvent({
        userId: cleanUserA,
        eventType: 'feature_use',
        timestamp: new Date().toISOString(),
        context: [{ label: 'github_repo', hash: sharedGithubRepo }]
    } as MonitorEvent);

    console.log("Result A (Context Overlap):");
    console.log(JSON.stringify(resultA, null, 2));

    console.log(`\n4. Simulating Clean User B (${cleanUserB}) uploading the exact same Private File (Content)`);
    await supabaseAdmin.from('ts_users').insert([{ id: cleanUserB, highest_risk_score: 0, last_decision: 'ALLOW' }]);
    
    // Testing Content Only
    const resultB = await trackEvent({
        userId: cleanUserB,
        eventType: 'feature_use',
        timestamp: new Date().toISOString(),
        content: [{ label: 'uploaded_db', hash: sharedPrivateFileHash }]
    } as MonitorEvent);

    console.log("Result B (Content Overlap):");
    console.log(JSON.stringify(resultB, null, 2));

    if (resultA.contextRiskScore === 30 && resultA.action === 'NONE') {
        console.log("\nPASS: Context overlap gave +30 risk points but did NOT ban.");
    } else {
        console.log("\nFAILED: Context overlap should not instantly ban.");
    }

    if (resultB.action === 'REVOKE') {
        console.log("PASS: Content file overlap triggered an instant REVOKE (Ban).");
    } else {
        console.log("FAILED: Content file overlap must REVOKE.");
    }
}

runTest().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
