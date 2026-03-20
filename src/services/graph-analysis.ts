// TrialShield — Graph & Link Analysis Module (HARDENED)
// Multi-dimensional abuse network detection: device, IP, email normalization, payment BIN,
// browser fingerprint similarity, timezone correlation, user agent clustering

import { GraphAnalysis, RiskSignal } from '@/types';
import { supabaseAdmin } from '@/lib/supabase';
import { sha256, normalizeEmail } from '@/lib/utils';

// ─── Main Analysis Function ──────────────────────────────────
export async function analyzeGraph(
    email?: string,
    phone?: string,
    ip?: string,
    deviceId?: string,
    metadata?: {
        paymentBin?: string;      // First 6-8 digits of credit card
        browserTimezone?: string;  // e.g. "America/New_York"
        userAgent?: string;
        screenResolution?: string; // e.g. "1920x1080"
        language?: string;         // e.g. "en-US"
    }
): Promise<GraphAnalysis> {
    const signals: RiskSignal[] = [];
    let score = 0;
    const deviceCluster: string[] = [];
    const ipCluster: string[] = [];
    const emailDomainCluster: string[] = [];
    let linkedAccounts = 0;
    let coordinatedAttack = false;

    // Run ALL link analyses in parallel for speed
    const analyses = await Promise.allSettled([
        deviceId ? analyzeDeviceCluster(deviceId) : null,
        ip ? analyzeIPCluster(ip) : null,
        email ? analyzeEmailCluster(email) : null,
        email ? analyzeNormalizedEmailLinks(email) : null,
        phone ? analyzePhoneLinks(phone) : null,
        metadata?.paymentBin ? analyzePaymentBIN(metadata.paymentBin) : null,
        deviceId && metadata ? analyzeBrowserSimilarity(deviceId, metadata) : null,
    ]);

    // ─── 1. Device cluster ───────────────────────────────────
    const deviceResult = analyses[0]?.status === 'fulfilled' ? analyses[0].value : null;
    if (deviceResult) {
        deviceCluster.push(...deviceResult.userIds);
        linkedAccounts = Math.max(linkedAccounts, deviceResult.userIds.length);
        if (deviceResult.userIds.length > 1) {  // Lowered from >2: even 2 accounts on same device is suspicious
            const severity = deviceResult.userIds.length > 5 ? 'CRITICAL' : 
                            deviceResult.userIds.length > 2 ? 'HIGH' : 'MEDIUM';
            score += Math.min(50, deviceResult.userIds.length * 15); // Increased from *10
            signals.push({
                module: 'GRAPH', signal: 'DEVICE_CLUSTER', severity,
                description: `Device shared across ${deviceResult.userIds.length} accounts`,
                value: deviceResult.userIds.length,
            });
            if (deviceResult.userIds.length > 1) {
                signals.push({
                    module: 'GRAPH', signal: 'MULTI_ACCOUNT_DEVICE', severity,
                    description: `${deviceResult.userIds.length} accounts detected on this device`,
                    value: deviceResult.userIds.length,
                });
            }
        }
    }

    // ─── 2. IP cluster (time-windowed) ───────────────────────
    const ipResult = analyses[1]?.status === 'fulfilled' ? analyses[1].value : null;
    if (ipResult) {
        ipCluster.push(...ipResult.userIds);
        linkedAccounts = Math.max(linkedAccounts, ipResult.userIds.length);

        // Time-windowed: accounts from same IP in last 24h are much more suspicious
        const recentCount = ipResult.recentUserIds?.length || 0;
        const totalCount = ipResult.userIds.length;

        if (recentCount > 2) {
            // Multiple signups from same IP in 24h = burst
            score += Math.min(45, recentCount * 12);
            signals.push({
                module: 'GRAPH', signal: 'IP_BURST_CLUSTER', severity: recentCount > 5 ? 'CRITICAL' : 'HIGH',
                description: `${recentCount} accounts created from this IP in the last 24 hours (burst)`,
                value: recentCount,
            });
            signals.push({
                module: 'GRAPH', signal: 'HIGH_SIGNUP_VELOCITY_IP', severity: 'HIGH',
                description: `Rapid signups from same IP — ${recentCount} in 24h`,
                value: recentCount,
            });
        }

        if (totalCount > 3) {
            score += Math.min(25, totalCount * 5);
            signals.push({
                module: 'GRAPH', signal: 'IP_CLUSTER',
                severity: totalCount > 10 ? 'CRITICAL' : 'HIGH',
                description: `${totalCount} total accounts from this IP address`,
                value: totalCount,
            });
        }
    }

    // ─── 3. Email domain cluster ─────────────────────────────
    const emailDomainResult = analyses[2]?.status === 'fulfilled' ? analyses[2].value : null;
    if (emailDomainResult && emailDomainResult.count > 10) {
        score += 15;
        emailDomainCluster.push(emailDomainResult.domain);
        signals.push({
            module: 'GRAPH', signal: 'EMAIL_DOMAIN_CLUSTER', severity: 'MEDIUM',
            description: `${emailDomainResult.count} accounts registered with @${emailDomainResult.domain}`,
            value: emailDomainResult.count,
        });
    }

    // ─── 4. NORMALIZED email links (catches dot tricks + aliases) ──
    const normalizedResult = analyses[3]?.status === 'fulfilled' ? analyses[3].value : null;
    if (normalizedResult && normalizedResult > 0) {
        score += Math.min(50, normalizedResult * 15);
        signals.push({
            module: 'GRAPH', signal: 'EMAIL_NORMALIZATION_LINK',
            severity: normalizedResult > 2 ? 'CRITICAL' : 'HIGH',
            description: `${normalizedResult} accounts share the same normalized email (dot trick / +alias variations)`,
            value: normalizedResult,
        });
    }

    // ─── 5. Phone links ──────────────────────────────────────
    const phoneResult = analyses[4]?.status === 'fulfilled' ? analyses[4].value : null;
    if (phoneResult && phoneResult > 1) {
        score += Math.min(40, phoneResult * 12);
        signals.push({
            module: 'GRAPH', signal: 'PHONE_REUSE_CLUSTER', severity: phoneResult > 3 ? 'CRITICAL' : 'HIGH',
            description: `Phone number shared across ${phoneResult} accounts`,
            value: phoneResult,
        });
    }

    // ─── 6. Payment BIN analysis ─────────────────────────────
    const paymentResult = analyses[5]?.status === 'fulfilled' ? analyses[5].value : null;
    if (paymentResult && paymentResult > 2) {
        score += Math.min(35, paymentResult * 10);
        signals.push({
            module: 'GRAPH', signal: 'PAYMENT_BIN_CLUSTER', severity: paymentResult > 5 ? 'CRITICAL' : 'HIGH',
            description: `Same payment card BIN used across ${paymentResult} trial accounts`,
            value: paymentResult,
        });
    }

    // ─── 7. Browser similarity ───────────────────────────────
    const browserResult = analyses[6]?.status === 'fulfilled' ? analyses[6].value : null;
    if (browserResult && browserResult.similarCount > 2) {
        score += Math.min(25, browserResult.similarCount * 8);
        signals.push({
            module: 'GRAPH', signal: 'BROWSER_SIMILARITY_CLUSTER',
            severity: browserResult.similarCount > 5 ? 'HIGH' : 'MEDIUM',
            description: `${browserResult.similarCount} accounts with similar browser fingerprint (UA+resolution+timezone)`,
            value: browserResult.similarCount,
        });
    }

    // ─── 8. Coordinated attack detection ─────────────────────
    // Multiple independent link types overlap → highly coordinated
    const linkTypes = [
        deviceCluster.length > 3,
        ipCluster.length > 3,
        (normalizedResult || 0) > 1,
        (phoneResult || 0) > 1,
        (paymentResult || 0) > 2,
    ].filter(Boolean).length;

    if (linkTypes >= 3) {
        coordinatedAttack = true;
        score += 40;
        signals.push({
            module: 'GRAPH', signal: 'COORDINATED_ATTACK', severity: 'CRITICAL',
            description: `Coordinated attack: ${linkTypes} independent link types connect these accounts`,
            value: linkTypes,
        });
    } else if (linkTypes >= 2) {
        score += 20;
        signals.push({
            module: 'GRAPH', signal: 'MULTI_LINK_ALERT', severity: 'HIGH',
            description: `Multiple link types detected: ${linkTypes} independent connections`,
            value: linkTypes,
        });
    }

    // ─── 9. Abuse network classification ─────────────────────
    if (linkedAccounts > 5 || coordinatedAttack) {
        score += 20;
        signals.push({
            module: 'GRAPH', signal: 'ABUSE_NETWORK', severity: 'CRITICAL',
            description: `Abuse network identified with ${linkedAccounts} linked accounts across ${linkTypes} connection types`,
            value: linkedAccounts,
        });
    }

    return {
        score: Math.min(100, score),
        linkedAccounts,
        deviceCluster,
        ipCluster,
        emailDomainCluster,
        coordinatedAttack,
        signals,
    };
}

// ─── Device Cluster Analysis ─────────────────────────────────
async function analyzeDeviceCluster(deviceId: string): Promise<{ userIds: string[] } | null> {
    try {
        const { data } = await supabaseAdmin
            .from('ts_device_graph')
            .select('user_id')
            .eq('device_fingerprint_id', deviceId);

        if (!data) return null;
        return { userIds: [...new Set(data.map(d => d.user_id))] };
    } catch { return null; }
}

// ─── IP Cluster Analysis (Time-Windowed) ─────────────────────
async function analyzeIPCluster(ip: string): Promise<{ userIds: string[]; recentUserIds: string[] } | null> {
    try {
        const ipHash = sha256(ip);

        // All-time accounts from this IP
        const { data: allData } = await supabaseAdmin
            .from('ts_risk_events')
            .select('user_id, created_at')
            .eq('ip_address', ipHash)
            .not('user_id', 'is', null)
            .limit(200);

        if (!allData) return null;

        const allUserIds = [...new Set(allData.map(d => d.user_id).filter(Boolean))];

        // Recent (last 24h) accounts — burst detection
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const recentUserIds = [...new Set(
            allData
                .filter(d => d.created_at && d.created_at >= since24h)
                .map(d => d.user_id)
                .filter(Boolean)
        )];

        return { userIds: allUserIds, recentUserIds };
    } catch { return null; }
}

// ─── Email Domain Cluster ────────────────────────────────────
async function analyzeEmailCluster(email: string): Promise<{ domain: string; count: number } | null> {
    try {
        const domain = email.split('@')[1];
        if (!domain) return null;

        const domainHash = sha256(domain);
        const { count } = await supabaseAdmin
            .from('ts_users')
            .select('*', { count: 'exact', head: true })
            .eq('email_domain_hash', domainHash);

        return { domain, count: count || 0 };
    } catch { return null; }
}

// ─── Normalized Email Links ──────────────────────────────────
// This is the KEY anti-abuse technique: catches users creating
// john.doe@gmail.com, johndoe@gmail.com, j.ohndoe+1@gmail.com etc.
async function analyzeNormalizedEmailLinks(email: string): Promise<number | null> {
    try {
        const normalized = normalizeEmail(email);
        const normalizedHash = sha256(normalized);

        const { count } = await supabaseAdmin
            .from('ts_users')
            .select('*', { count: 'exact', head: true })
            .eq('normalized_email_hash', normalizedHash);

        return Math.max(0, (count || 0) - 1); // Exclude self
    } catch { return null; }
}

// ─── Phone Reuse Links ──────────────────────────────────────
async function analyzePhoneLinks(phone: string): Promise<number | null> {
    try {
        const phoneHash = sha256(phone.replace(/[^0-9+]/g, ''));
        const { count } = await supabaseAdmin
            .from('ts_users')
            .select('*', { count: 'exact', head: true })
            .eq('phone_hash', phoneHash);

        return count || 0;
    } catch { return null; }
}

// ─── Payment BIN Analysis ────────────────────────────────────
// Tracks the first 6-8 digits of credit cards to detect
// same card used across multiple trial accounts
async function analyzePaymentBIN(bin: string): Promise<number | null> {
    try {
        const binHash = sha256(bin);
        const { count } = await supabaseAdmin
            .from('ts_payment_fingerprints')
            .select('*', { count: 'exact', head: true })
            .eq('bin_hash', binHash);

        return count || 0;
    } catch { return null; }
}

// ─── Browser Similarity Analysis ─────────────────────────────
// Detects users with near-identical browser environments across multiple accounts
async function analyzeBrowserSimilarity(
    deviceId: string,
    metadata: { browserTimezone?: string; screenResolution?: string; language?: string; userAgent?: string }
): Promise<{ similarCount: number } | null> {
    try {
        // Create a "soft fingerprint" from non-unique-but-combinatorially-rare attributes
        const softFingerprint = sha256(
            [
                metadata.browserTimezone || '',
                metadata.screenResolution || '',
                metadata.language || '',
                // Extract browser name+version from UA (not full UA to allow minor variations)
                metadata.userAgent ? extractBrowserSignature(metadata.userAgent) : '',
            ].join('|')
        );

        const { count } = await supabaseAdmin
            .from('ts_device_graph')
            .select('*', { count: 'exact', head: true })
            .eq('soft_fingerprint', softFingerprint)
            .neq('device_fingerprint_id', deviceId);

        return { similarCount: count || 0 };
    } catch { return null; }
}

// ─── Helpers ─────────────────────────────────────────────────
function extractBrowserSignature(userAgent: string): string {
    // Extract browser name and major version
    const match = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/(\d+)/);
    if (match) return `${match[1]}/${match[2]}`;

    // Check for mobile browsers
    const mobile = userAgent.match(/(CriOS|FxiOS|OPiOS|EdgiOS)\/(\d+)/);
    if (mobile) return `${mobile[1]}/${mobile[2]}`;

    return 'unknown';
}
