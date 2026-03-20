// TrialShield — ML Risk Scoring Engine (HARDENED)
// 15 cross-signal rules, weighted aggregation, explainable decisions

import {
    VerifyRequest, VerifyResponse, Decision, ScoreBreakdown,
    RiskSignal, EnrichmentData, ChallengeConfig
} from '@/types';
import { CONFIG } from '@/config';
import { analyzeEmail } from './email-intelligence';
import { analyzePhone } from './phone-intelligence';
import { analyzeIP } from './ip-intelligence';
import { analyzeDevice } from './device-fingerprint';
import { analyzeBehavior } from './behavioral-analysis';
import { analyzeGraph } from './graph-analysis';
import { analyzeOAuth } from './oauth-intelligence';
import { determineChallenge } from './adaptive-challenges';
import { supabaseAdmin } from '@/lib/supabase';
import { sha256, generateId, normalizeEmail } from '@/lib/utils';

// ─── Main Scoring Function ───────────────────────────────────
export async function evaluateRisk(
    request: VerifyRequest,
    apiKeyId?: string,
    resolvedUserId?: string
): Promise<VerifyResponse> {
    const startTime = Date.now();
    const evaluationId = generateId();
    const allSignals: RiskSignal[] = [];

    // Initialize scores
    let emailScore = 0, phoneScore = 0, ipScore = 0;
    let deviceScore = 0, behaviorScore = 0, graphScore = 0;
    let oauthScore = 0;

    const enrichment: EnrichmentData = { totalSignals: 0 };

    // ─── Run ALL modules in parallel ─────────────────────────
    const analyses = await Promise.allSettled([
        request.email ? analyzeEmail(request.email).then(result => {
            emailScore = result.score;
            allSignals.push(...result.signals);
            enrichment.email = result;
        }) : Promise.resolve(),

        request.phone ? analyzePhone(request.phone).then(result => {
            phoneScore = result.score;
            allSignals.push(...result.signals);
            enrichment.phone = result;
        }) : Promise.resolve(),

        request.ip ? analyzeIP(request.ip).then(result => {
            ipScore = result.score;
            allSignals.push(...result.signals);
            enrichment.ip = result;
        }) : Promise.resolve(),

        request.deviceFingerprint ? analyzeDevice(request.deviceFingerprint).then(result => {
            deviceScore = result.score;
            allSignals.push(...result.signals);
            enrichment.device = request.deviceFingerprint;
        }) : Promise.resolve(),

        request.ip ? analyzeBehavior(
            request.ip,
            request.email,
            request.deviceFingerprint?.id,
            request.metadata as any
        ).then(result => {
            behaviorScore = result.score;
            allSignals.push(...result.signals);
            enrichment.behavior = result;
        }) : Promise.resolve(),

        analyzeGraph(
            request.email,
            request.phone,
            request.ip,
            request.deviceFingerprint?.id,
            request.metadata as any
        ).then(result => {
            graphScore = result.score;
            allSignals.push(...result.signals);
            enrichment.graph = result;
        }),

        // OAuth account analysis (Google, GitHub, etc.)
        request.oauthProvider ? analyzeOAuth(request.oauthProvider).then(result => {
            oauthScore = result.score;
            allSignals.push(...result.signals);
            enrichment.oauth = result as any;
        }) : Promise.resolve(),
    ]);

    // Log failures
    analyses.forEach((result, i) => {
        if (result.status === 'rejected') {
            console.error(`[TrialShield] Module ${i} failed:`, result.reason);
        }
    });

    // ─── Calculate weighted final score ───────────────────────
    const weights = CONFIG.weights;
    let finalScore = Math.min(100, Math.round(
        emailScore * weights.email +
        phoneScore * weights.phone +
        ipScore * weights.ip +
        deviceScore * weights.device +
        behaviorScore * weights.behavior +
        graphScore * weights.graph
    ));

    // OAuth score is additive (not weighted) — it's a direct penalty/bonus
    if (oauthScore !== 0) {
        finalScore = Math.min(100, Math.max(0, finalScore + oauthScore));
    }

    // ─── Apply 15 cross-signal rules ─────────────────────────
    const ruleScore = applyRules(allSignals, finalScore);

    // ─── Make decision ────────────────────────────────────────
    const decision = makeDecision(ruleScore);
    const challenge = decision === 'CHALLENGE' ? determineChallenge(ruleScore) : undefined;

    const breakdown: ScoreBreakdown = {
        emailScore, phoneScore, ipScore, deviceScore,
        behaviorScore, graphScore,
        finalScore: ruleScore,
        weights: weights as unknown as Record<string, number>,
    };

    enrichment.totalSignals = allSignals.length;
    const processingTimeMs = Date.now() - startTime;

    // ─── Record in database ───────────────────────────────────
    try {
        const emailHash = request.email ? sha256(request.email) : null;
        const phoneHash = request.phone ? sha256(request.phone.replace(/[^0-9+]/g, '')) : null;
        const normalizedEmailHash = request.email ? sha256(normalizeEmail(request.email)) : null;
        const emailDomainHash = request.email ? sha256(request.email.split('@')[1] || '') : null;

        let userId: string | null = resolvedUserId || null;

        if (userId) {
            // Update the user passed by identity-resolver with all hashes and scores
            await supabaseAdmin.from('ts_users').update({
                email_hash: emailHash || undefined,
                phone_hash: phoneHash || undefined,
                normalized_email_hash: normalizedEmailHash || undefined,
                email_domain_hash: emailDomainHash || undefined,
                last_seen: new Date().toISOString(),
                // Use postgres MAX via RPC or fetch first (we fetch later, simplified for MVP but safe enough)
                highest_risk_score: ruleScore,
                last_decision: decision,
            }).eq('id', userId);
        } else if (emailHash || phoneHash) {
            // Fallback for V1 endpoints that don't pass resolvedUserId
            let query = supabaseAdmin.from('ts_users').select('id');
            if (emailHash) query = query.eq('email_hash', emailHash);
            else if (phoneHash) query = query.eq('phone_hash', phoneHash);

            const { data: existingUser } = await query.single();

            if (existingUser) {
                userId = existingUser.id;
                await supabaseAdmin.from('ts_users').update({
                    last_seen: new Date().toISOString(),
                    highest_risk_score: ruleScore,
                    last_decision: decision,
                }).eq('id', userId);
            } else {
                const { data: newUser } = await supabaseAdmin.from('ts_users').insert({
                    email_hash: emailHash,
                    phone_hash: phoneHash,
                    normalized_email_hash: normalizedEmailHash,
                    email_domain_hash: emailDomainHash,
                    highest_risk_score: ruleScore,
                    last_decision: decision,
                }).select('id').single();
                userId = newUser?.id || null;
            }
        }

        // Record risk event
        await supabaseAdmin.from('ts_risk_events').insert({
            id: evaluationId,
            user_id: userId,
            decision,
            risk_score: ruleScore,
            email_score: emailScore,
            phone_score: phoneScore,
            ip_score: ipScore,
            device_score: deviceScore,
            behavior_score: behaviorScore,
            graph_score: graphScore,
            signals: allSignals,
            enrichment,
            ip_address: request.ip ? sha256(request.ip) : null,
            device_fingerprint_id: request.deviceFingerprint?.id,
            processing_time_ms: processingTimeMs,
            api_key_id: apiKeyId,
        });

        // Record payment fingerprint if provided
        if (request.metadata?.paymentBin && userId) {
            await supabaseAdmin.from('ts_payment_fingerprints').upsert({
                user_id: userId,
                bin_hash: sha256(String(request.metadata.paymentBin)),
                last_seen: new Date().toISOString(),
            }, { onConflict: 'user_id,bin_hash' });
        }

        // Record soft fingerprint for browser similarity
        if (request.deviceFingerprint?.id && request.metadata && userId) {
            const softFp = sha256([
                String(request.metadata.browserTimezone || ''),
                String(request.metadata.screenResolution || ''),
                String(request.metadata.language || ''),
            ].join('|'));

            await supabaseAdmin.from('ts_device_graph').update({
                soft_fingerprint: softFp,
            }).eq('device_fingerprint_id', request.deviceFingerprint.id)
                .eq('user_id', userId);
        }
    } catch (error) {
        console.error('[TrialShield] Failed to record evaluation:', error);
    }

    const response: VerifyResponse = {
        id: evaluationId,
        decision,
        riskScore: ruleScore,
        signals: allSignals,
        breakdown,
        challenge,
        enrichment,
        processingTimeMs,
        timestamp: new Date().toISOString(),
    };

    // Shadow mode
    if (CONFIG.features.shadowMode && decision !== 'ALLOW') {
        response.decision = 'ALLOW';
        response.signals.push({
            module: 'RULES', signal: 'SHADOW_MODE', severity: 'LOW',
            description: `Shadow mode active — would have been ${decision} with score ${ruleScore}`,
        });
    }

    return response;
}

// ─── Rule Engine (15 Cross-Signal Rules) ─────────────────────
function applyRules(signals: RiskSignal[], baseScore: number): number {
    let score = baseScore;
    const signalNames = new Set(signals.map(s => s.signal));

    // Rule 1: Disposable + VPN = auto high risk
    if (signalNames.has('DISPOSABLE_EMAIL') &&
        (signalNames.has('VPN_DETECTED') || signalNames.has('VPN_ASN') || signalNames.has('PROXY_DETECTED'))) {
        score = Math.max(score, 88);
        signals.push({
            module: 'RULES', signal: 'RULE_DISPOSABLE_VPN', severity: 'CRITICAL',
            description: 'Disposable email + VPN/Proxy'
        });
    }

    // Rule 2: TOR + any critical = auto deny
    if (signalNames.has('TOR_EXIT_NODE') && signals.some(s => s.severity === 'CRITICAL')) {
        score = Math.max(score, 95);
        signals.push({
            module: 'RULES', signal: 'RULE_TOR_CRITICAL', severity: 'CRITICAL',
            description: 'TOR exit node + critical signals'
        });
    }

    // Rule 3: Multi-account device + velocity = coordinated
    if (signalNames.has('MULTI_ACCOUNT_DEVICE') &&
        (signalNames.has('HIGH_SIGNUP_VELOCITY_IP') || signalNames.has('HIGH_SIGNUP_VELOCITY_DEVICE'))) {
        score = Math.max(score, 92);
        signals.push({
            module: 'RULES', signal: 'RULE_MULTI_ACCOUNT_VELOCITY', severity: 'CRITICAL',
            description: 'Multi-account device + high velocity'
        });
    }

    // Rule 4: Automation/headless = auto high risk
    if (signalNames.has('HEADLESS_BROWSER') || signalNames.has('AUTOMATION_DETECTED')) {
        score = Math.max(score, 82);
        signals.push({
            module: 'RULES', signal: 'RULE_AUTOMATION', severity: 'CRITICAL',
            description: 'Automated/headless browser detected'
        });
    }

    // Rule 5: VOIP + Disposable = very suspicious
    if ((signalNames.has('VOIP_NUMBER') || signalNames.has('VOIP_CARRIER_API') || signalNames.has('VOIP_CARRIER_DB')) &&
        signalNames.has('DISPOSABLE_EMAIL')) {
        score = Math.max(score, 85);
        signals.push({
            module: 'RULES', signal: 'RULE_VOIP_DISPOSABLE', severity: 'CRITICAL',
            description: 'VOIP number + disposable email'
        });
    }

    // Rule 6: Impossible travel
    if (signalNames.has('IMPOSSIBLE_TRAVEL')) {
        score = Math.max(score, 72);
        signals.push({
            module: 'RULES', signal: 'RULE_IMPOSSIBLE_TRAVEL', severity: 'HIGH',
            description: 'Impossible travel detected'
        });
    }

    // Rule 7: Coordinated attack = auto deny
    if (signalNames.has('COORDINATED_ATTACK') || signalNames.has('ABUSE_NETWORK')) {
        score = Math.max(score, 95);
        signals.push({
            module: 'RULES', signal: 'RULE_COORDINATED_ATTACK', severity: 'CRITICAL',
            description: 'Coordinated attack/abuse network'
        });
    }

    // Rule 8: Email normalization duplicate + ANY other signal = probable abuser
    if (signalNames.has('NORMALIZED_DUPLICATE') || signalNames.has('EMAIL_NORMALIZATION_LINK')) {
        const hasOtherSignal = signalNames.has('VPN_DETECTED') || signalNames.has('PROXY_DETECTED') ||
            signalNames.has('VOIP_NUMBER') || signalNames.has('DATACENTER_ASN');
        if (hasOtherSignal) {
            score = Math.max(score, 85);
            signals.push({
                module: 'RULES', signal: 'RULE_NORMALIZED_EMAIL_MULTI', severity: 'CRITICAL',
                description: 'Normalized email duplicate + evasion signals'
            });
        } else {
            score = Math.max(score, 65);
        }
    }

    // Rule 9: Payment BIN reuse across multiple trials
    if (signalNames.has('PAYMENT_BIN_CLUSTER')) {
        score = Math.max(score, 78);
        signals.push({
            module: 'RULES', signal: 'RULE_PAYMENT_REUSE', severity: 'HIGH',
            description: 'Same payment card used across multiple trial accounts'
        });
    }

    // Rule 10: Phone reuse + new email = trial cycling
    if (signalNames.has('PHONE_REUSED') && !signalNames.has('NORMALIZED_DUPLICATE')) {
        score = Math.max(score, 70);
        signals.push({
            module: 'RULES', signal: 'RULE_PHONE_REUSE_NEW_EMAIL', severity: 'HIGH',
            description: 'Same phone with different email — likely trial cycling'
        });
    }

    // Rule 11: Datacenter IP + bot score = automated attack
    if ((signalNames.has('DATACENTER_ASN') || signalNames.has('HOSTING_IP')) &&
        (signalNames.has('LOW_MOUSE_ENTROPY') || signalNames.has('UNIFORM_KEYSTROKES'))) {
        score = Math.max(score, 88);
        signals.push({
            module: 'RULES', signal: 'RULE_DATACENTER_BOT', severity: 'CRITICAL',
            description: 'Datacenter IP + bot-like behavior'
        });
    }

    // Rule 12: Residential proxy = sophisticated evasion
    if (signalNames.has('RESIDENTIAL_PROXY')) {
        score = Math.max(score, 80);
        signals.push({
            module: 'RULES', signal: 'RULE_RESIDENTIAL_PROXY', severity: 'CRITICAL',
            description: 'Residential proxy — sophisticated evasion technique'
        });
    }

    // Rule 13: Spoofing + proxy = anti-detect browser
    if (signalNames.has('SPOOFING_DETECTED') && (signalNames.has('PROXY_DETECTED') || signalNames.has('VPN_DETECTED'))) {
        score = Math.max(score, 90);
        signals.push({
            module: 'RULES', signal: 'RULE_ANTIDETECT', severity: 'CRITICAL',
            description: 'Fingerprint spoofing + proxy — anti-detect browser'
        });
    }

    // Rule 14: Triple threat: disposable + VOIP + VPN = definite abuser
    if (signalNames.has('DISPOSABLE_EMAIL') &&
        (signalNames.has('VOIP_NUMBER') || signalNames.has('VOIP_CARRIER_API')) &&
        (signalNames.has('VPN_DETECTED') || signalNames.has('VPN_ASN') || signalNames.has('PROXY_DETECTED'))) {
        score = Math.max(score, 95);
        signals.push({
            module: 'RULES', signal: 'RULE_TRIPLE_THREAT', severity: 'CRITICAL',
            description: 'Triple threat: disposable email + VOIP + VPN/Proxy'
        });
    }

    // Rule 15: 3+ CRITICAL signals from different modules = high confidence abuse
    const criticalModules = new Set(
        signals.filter(s => s.severity === 'CRITICAL').map(s => s.module)
    );
    if (criticalModules.size >= 3) {
        score = Math.max(score, 92);
        signals.push({
            module: 'RULES', signal: 'RULE_MULTI_MODULE_CRITICAL', severity: 'CRITICAL',
            description: `Critical signals from ${criticalModules.size} independent modules`
        });
    }

    // ═══════════════════════════════════════════════════════════
    // NEW RULES (v3) — Enhanced Pre-Signup Detection
    // ═══════════════════════════════════════════════════════════

    // Rule 16: New domain + any proxy/VPN = fresh throwaway domain for abuse
    if (signalNames.has('NEW_DOMAIN') && 
        (signalNames.has('VPN_DETECTED') || signalNames.has('PROXY_DETECTED') || signalNames.has('RESIDENTIAL_PROXY'))) {
        score = Math.max(score, 82);
        signals.push({
            module: 'RULES', signal: 'RULE_NEW_DOMAIN_PROXY', severity: 'CRITICAL',
            description: 'Newly registered email domain + VPN/Proxy — likely throwaway identity'
        });
    }

    // Rule 17: No MX records + disposable TLD = phantom domain
    if (signalNames.has('NO_MX_RECORDS') && signalNames.has('SUSPICIOUS_TLD')) {
        score = Math.max(score, 88);
        signals.push({
            module: 'RULES', signal: 'RULE_PHANTOM_DOMAIN', severity: 'CRITICAL',
            description: 'No MX records + suspicious TLD — phantom domain created for abuse'
        });
    }

    // Rule 18: Multi-account device + normalized email = same person cycling accounts
    if (signalNames.has('MULTI_ACCOUNT_DEVICE') && 
        (signalNames.has('NORMALIZED_DUPLICATE') || signalNames.has('EMAIL_NORMALIZATION_LINK'))) {
        score = Math.max(score, 93);
        signals.push({
            module: 'RULES', signal: 'RULE_DEVICE_EMAIL_LINK', severity: 'CRITICAL',
            description: 'Same device + email variations — definite trial cycling'
        });
    }

    // Rule 19: Random email pattern + datacenter IP + new user = bot signup
    if (signalNames.has('RANDOM_PATTERN') && 
        (signalNames.has('DATACENTER_ASN') || signalNames.has('HOSTING_IP')) &&
        !signalNames.has('BREACHED_EMAIL')) { // Breached emails are real, so exclude
        score = Math.max(score, 80);
        signals.push({
            module: 'RULES', signal: 'RULE_BOT_SIGNUP', severity: 'CRITICAL',
            description: 'Randomly generated email + datacenter IP — automated signup attempt'
        });
    }

    // Rule 20: Phone reuse + device reuse = definite duplicate (strongest combo)
    if ((signalNames.has('PHONE_REUSE_CLUSTER') || signalNames.has('PHONE_REUSED')) &&
        (signalNames.has('DEVICE_CLUSTER') || signalNames.has('MULTI_ACCOUNT_DEVICE'))) {
        score = Math.max(score, 95);
        signals.push({
            module: 'RULES', signal: 'RULE_PHONE_DEVICE_REUSE', severity: 'CRITICAL',
            description: 'Same phone + same device across accounts — definite duplicate user'
        });
    }

    // Rule 21: Catch-all domain + alias + VPN = sophisticated evasion
    if (signalNames.has('CATCH_ALL_DOMAIN') && signalNames.has('ALIAS_DETECTED') &&
        (signalNames.has('VPN_DETECTED') || signalNames.has('PROXY_DETECTED'))) {
        score = Math.max(score, 85);
        signals.push({
            module: 'RULES', signal: 'RULE_CATCHALL_ALIAS_VPN', severity: 'CRITICAL',
            description: 'Catch-all domain + email alias + VPN — sophisticated multi-account evasion'
        });
    }

    // Rule 22: IP cluster (>5 accounts) + payment BIN cluster = organized fraud ring
    if (signalNames.has('IP_CLUSTER') && signalNames.has('PAYMENT_BIN_CLUSTER')) {
        score = Math.max(score, 95);
        signals.push({
            module: 'RULES', signal: 'RULE_IP_PAYMENT_RING', severity: 'CRITICAL',
            description: 'Multiple accounts from same IP using same payment card — organized fraud'
        });
    }

    // Rule 23: Email domain cluster (>10) + any HIGH signal = bulk abuse operation
    if (signalNames.has('EMAIL_DOMAIN_CLUSTER') &&
        signals.some(s => s.severity === 'HIGH' || s.severity === 'CRITICAL')) {
        score = Math.max(score, 78);
        signals.push({
            module: 'RULES', signal: 'RULE_BULK_EMAIL_ABUSE', severity: 'HIGH',
            description: 'High concentration of accounts from same email domain + risk signals'
        });
    }

    // Rule 24: 4+ signals of ANY severity from GRAPH module = strong linkage
    const graphSignals = signals.filter(s => s.module === 'GRAPH' && s.severity !== 'LOW');
    if (graphSignals.length >= 4) {
        score = Math.max(score, 85);
        signals.push({
            module: 'RULES', signal: 'RULE_HEAVY_GRAPH_LINKAGE', severity: 'CRITICAL',
            description: `${graphSignals.length} graph connection signals — heavily linked identity`
        });
    }

    // Rule 25: Score already >= 50 from modules + browser similarity = confirmation
    if (baseScore >= 50 && signalNames.has('BROWSER_SIMILARITY_CLUSTER')) {
        score = Math.max(score, Math.min(95, baseScore + 25));
        signals.push({
            module: 'RULES', signal: 'RULE_SCORE_BROWSER_CONFIRM', severity: 'HIGH',
            description: 'High base risk score confirmed by browser fingerprint similarity'
        });
    }

    return Math.min(100, score);
}

// ─── Decision Engine ─────────────────────────────────────────
function makeDecision(score: number): Decision {
    if (score <= CONFIG.thresholds.allow) return 'ALLOW';
    if (score <= CONFIG.thresholds.challenge) return 'CHALLENGE';
    return 'DENY';
}
