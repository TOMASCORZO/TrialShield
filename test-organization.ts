import { trackEvent } from './src/services/post-signup-monitor';
import { supabaseAdmin } from './src/lib/supabase';
import { generateId } from './src/lib/utils';
import { MonitorEvent } from './src/types';

async function runTest() {
    console.log("--- Starting Organization Exemption Test ---");

    const sharedFileHash = "org_a_secret_file_" + Date.now();
    const sharedFileHash2 = "org_b_stolen_file_" + Date.now();

    // 1. Create a bad user belonging to ORG_A
    const badUserId = generateId();
    console.log(`\n1. Creating Bad User in ORG_A: ${badUserId}`);
    await supabaseAdmin.from('ts_users').insert([{ 
        id: badUserId, 
        highest_risk_score: 100, 
        last_decision: 'DENY',
        is_quarantined: true,
        metadata: { organizationId: 'ORG_A' }
    }]);

    // Give them an anchor
    await trackEvent({
        userId: badUserId,
        eventType: 'feature_use',
        timestamp: new Date().toISOString(),
        organizationId: 'ORG_A',
        content: [{ label: 'upload', hash: sharedFileHash }, { label: 'upload2', hash: sharedFileHash2 }]
    } as MonitorEvent);

    // 2. Create Clean User from ORG_B (Different Org)
    const userDifferentOrg = generateId();
    console.log(`\n2. Creating Clean User in ORG_B: ${userDifferentOrg}`);
    await supabaseAdmin.from('ts_users').insert([{ 
        id: userDifferentOrg, highest_risk_score: 0, last_decision: 'ALLOW', 
        metadata: { organizationId: 'ORG_B' } 
    }]);

    const resultDiffOrg = await trackEvent({
        userId: userDifferentOrg,
        eventType: 'feature_use',
        organizationId: 'ORG_B',
        timestamp: new Date().toISOString(),
        content: [{ label: 'upload', hash: sharedFileHash2 }]
    } as MonitorEvent);
    
    console.log("Result for User in DIFFERENT ORG:");
    console.log(JSON.stringify(resultDiffOrg, null, 2));


    // 3. Create Clean User from ORG_A (Same Org as Bad User)
    const userSameOrg = generateId();
    console.log(`\n3. Creating Clean User in ORG_A: ${userSameOrg}`);
    await supabaseAdmin.from('ts_users').insert([{ 
        id: userSameOrg, highest_risk_score: 0, last_decision: 'ALLOW', 
        metadata: { organizationId: 'ORG_A' } 
    }]);

    const resultSameOrg = await trackEvent({
        userId: userSameOrg,
        eventType: 'feature_use',
        organizationId: 'ORG_A',
        timestamp: new Date().toISOString(),
        content: [{ label: 'upload', hash: sharedFileHash }]
    } as MonitorEvent);
    
    console.log("Result for User in SAME ORG:");
    console.log(JSON.stringify(resultSameOrg, null, 2));


    // Verify outputs
    if (resultDiffOrg.action === 'REVOKE') {
        console.log("\n✅ PASS: User in a different org was correctly REVOKED for sharing content with a banned user.");
    } else {
        console.log("\n❌ FAILED: User in a different org should have been revoked.");
    }

    if (resultSameOrg.action === 'NONE') {
        console.log("✅ PASS: User in the SAME org was correctly EXEMPT from the ban despite sharing content.");
    } else {
        console.log("❌ FAILED: User in the SAME org should be exempt.");
    }
}

runTest().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
