// TrialShield — Post-Signup Monitoring Module (v3)
// Usage velocity tracking, anomaly detection, auto-quarantine
// Trial-aware context fingerprinting with weighted scoring

import { MonitorEvent, MonitorResult, RiskSignal, AccountStatus } from '@/types';
import { CONFIG } from '@/config';
import { supabaseAdmin } from '@/lib/supabase';
import { minutesAgo, hoursAgo, sha256 } from '@/lib/utils';
import { revokeUserAccess, linkAnchor } from './identity-resolver';

// ─── Track Event ─────────────────────────────────────────────
export async function trackEvent(event: MonitorEvent): Promise<MonitorResult> {
    // 1. Record the event
    try {
        await supabaseAdmin.from('ts_monitor_events').insert({
            user_id: event.userId,
            event_type: event.eventType,
            metadata: event.metadata || {},
        });
    } catch (error) {
        console.error('[TrialShield] Failed to record monitor event:', error);
    }

    // 2. Calculate usage velocity (events per minute)
    const since = minutesAgo(1).toISOString();
    const { count: recentEvents } = await supabaseAdmin
        .from('ts_monitor_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', event.userId)
        .gte('created_at', since);

    const usageVelocity = recentEvents || 0;

    // 3. Calculate anomaly score
    const anomalyScore = await calculateAnomalyScore(event.userId, usageVelocity);

    // 4. Check Current Revoked Status
    const userStatus = await checkRevokedStatus(event.userId);
    const isRevoked = userStatus.isRevoked;
    const currentOrgId = event.organizationId || userStatus.organizationId;
    const currentAccountStatus = event.accountStatus || userStatus.accountStatus || 'trial_active';

    // 5. Cross-Account Infection Check
    let crossAccountRevoked = false;
    let crossMatchedUserId: string | undefined;
    const liveAnchors: { type: string; hash: string }[] = [];

    if (event.deviceFingerprint) {
        const deviceRawId = event.deviceFingerprint.idfv || event.deviceFingerprint.androidId || event.deviceFingerprint.id;
        if (deviceRawId) {
            const deviceHash = sha256(deviceRawId);
            liveAnchors.push({ type: 'device', hash: deviceHash });
        }
    }

    // Extract Payment Anchors dynamically
    const payment = event.metadata?.payment as Record<string, string> | undefined;
    if (payment) {
        if (payment.fingerprint) liveAnchors.push({ type: 'card_fingerprint', hash: sha256(payment.fingerprint) });
        if (payment.bin && payment.last4) liveAnchors.push({ type: 'card_bin_last4', hash: sha256(`${payment.bin.replace(/[^0-9]/g, '')}_${payment.last4.replace(/[^0-9]/g, '')}`) });
        if (payment.last4 && payment.billingZip) liveAnchors.push({ type: 'card_last4_zip', hash: sha256(`${payment.last4.replace(/[^0-9]/g, '')}_${payment.billingZip.trim()}`) });
        if (payment.name) liveAnchors.push({ type: 'card_name', hash: sha256(payment.name.toLowerCase().trim()) });
    }

    // ─── CONTEXT FINGERPRINTING (v3 — Weighted, Trial-Aware) ──
    const contextOverlapUserIds = new Set<string>();
    let contextRiskScore = 0;
    
    if (event.context && Array.isArray(event.context)) {
        // Group overlaps by matched user for volume escalation
        const perUserContextScore = new Map<string, { count: number; totalScore: number; labels: string[] }>();
        
        for (const item of event.context) {
            const contextHash = sha256(`context_${item.label}_${item.hash}`);
            // Link Context to the user so it's tracked forever
            await linkAnchor(event.userId, 'context', contextHash);
            
            // Query for overlapping Contexts
            const { data: overlappingContexts } = await supabaseAdmin
                .from('ts_identity_anchors')
                .select('user_id')
                .eq('anchor_type', 'context')
                .eq('anchor_hash', contextHash)
                .neq('user_id', event.userId);
                
            if (overlappingContexts && overlappingContexts.length > 0) {
                const linkedUserIds = overlappingContexts.map(c => c.user_id);
                const { data: contextUsers } = await supabaseAdmin
                    .from('ts_users')
                    .select('id, metadata, account_status, trial_expires_at')
                    .in('id', linkedUserIds);
                    
                if (contextUsers) {
                    for (const u of contextUsers) {
                        const uOrgId = (u.metadata as Record<string, any>)?.organizationId;
                        
                        // Organization Exemption
                        if (currentOrgId && uOrgId && currentOrgId === uOrgId) {
                            continue;
                        }

                        // ─── TRIAL-AWARE CONTEXT SCORING ────────────
                        const matchedStatus = resolveAccountStatus(u.account_status, u.trial_expires_at);

                        // PAID USER → SKIP entirely
                        if (matchedStatus === 'paid') {
                            continue;
                        }

                        // Weighted context scoring based on label type
                        const contextWeights = CONFIG.contextWeights;
                        const labelWeight: number = (contextWeights[item.label as keyof typeof contextWeights]
                            ?? contextWeights.default) as number;

                        let effectiveWeight: number = labelWeight;

                        // TRIAL ACTIVE → Apply reduced multiplier
                        if (matchedStatus === 'trial_active') {
                            effectiveWeight = Math.round(labelWeight * (CONFIG.collaboratorFactors.trialActiveMultiplier as number));
                        }

                        // Recency penalty: contexts created in last 24h get 1.5x
                        const anchorAge = await getAnchorAge(u.id, contextHash);
                        if (anchorAge !== null && anchorAge < 24 * 60 * 60 * 1000) {
                            effectiveWeight = Math.round(effectiveWeight * 1.5);
                        }

                        contextOverlapUserIds.add(u.id);
                        contextRiskScore += effectiveWeight;

                        // Track per-user aggregation
                        if (!perUserContextScore.has(u.id)) {
                            perUserContextScore.set(u.id, { count: 0, totalScore: 0, labels: [] });
                        }
                        const userData = perUserContextScore.get(u.id)!;
                        userData.count++;
                        userData.totalScore += effectiveWeight;
                        userData.labels.push(item.label);
                    }
                }
            }
        }

        // ─── VOLUME ESCALATION ────────────────────────────────
        // If a single user shares >3 distinct contexts → escalate dramatically
        for (const [matchedUserId, data] of perUserContextScore.entries()) {
            if (data.count >= 3) {
                // Check if matched user's trial is expired (full escalation)
                const { data: matchedUser } = await supabaseAdmin
                    .from('ts_users')
                    .select('account_status, trial_expires_at')
                    .eq('id', matchedUserId)
                    .single();

                const matchedStatus = matchedUser
                    ? resolveAccountStatus(matchedUser.account_status, matchedUser.trial_expires_at)
                    : 'trial_active';

                if (matchedStatus === 'trial_expired') {
                    // Expired trial + 3+ shared contexts → very suspicious
                    contextRiskScore += 50; // Bonus penalty
                    // This will push the action toward REVOKE via liveAnchors check below
                }
            }
        }
    }

    // ─── CONTENT FINGERPRINTING (Hard Anchors) ───────────────
    if (event.content && Array.isArray(event.content)) {
        for (const item of event.content) {
            const contentHash = sha256(`content_${item.label}_${item.hash}`);
            liveAnchors.push({ type: 'content_fingerprint', hash: contentHash });
        }
    }

    if (liveAnchors.length > 0) {
        // Link all extracted Hard Anchors to the current user
        for (const anchor of liveAnchors) {
            await linkAnchor(event.userId, anchor.type as any, anchor.hash);
        }

        // Have we seen ANY of these Hard Anchors on a revoked account?
        const hashes = liveAnchors.map(a => a.hash);
        const { data: linkedAnchors } = await supabaseAdmin
            .from('ts_identity_anchors')
            .select('user_id')
            .in('anchor_hash', hashes)
            .neq('user_id', event.userId);

        if (linkedAnchors && linkedAnchors.length > 0) {
            const linkedUserIds = linkedAnchors.map(a => a.user_id);
            const { data: badUsers } = await supabaseAdmin
                .from('ts_users')
                .select('id, metadata, account_status, trial_expires_at')
                .in('id', linkedUserIds)
                .eq('is_quarantined', true);

            if (badUsers && badUsers.length > 0) {
                for (const badUser of badUsers) {
                    const badUserOrgId = (badUser.metadata as Record<string, any>)?.organizationId;
                    
                    // Organization Exemption
                    if (currentOrgId && badUserOrgId && String(currentOrgId) === String(badUserOrgId)) {
                        continue;
                    }

                    // Trial-Aware: Only cross-revoke if the bad user isn't paid
                    // (A paid user that was manually quarantined is a different case)
                    const badUserStatus = resolveAccountStatus(badUser.account_status, badUser.trial_expires_at);
                    if (badUserStatus === 'paid') {
                        continue; // Paid user quarantine is admin-managed, don't auto-infect
                    }

                    crossAccountRevoked = true;
                    crossMatchedUserId = badUser.id;
                    break;
                }
            }
        }
    }

    // 6. Determine action
    let action: MonitorResult['action'] = 'NONE';

    // Critical Bans (Device, Payment, Profile Content Overlap)
    if (crossAccountRevoked) {
        action = 'REVOKE';
        await revokeUserAccess(event.userId, `Identity overlaps with a previously REVOKED account (Device/Card/Content)`, crossMatchedUserId);
    } else if (anomalyScore >= CONFIG.monitoring.quarantineScore) {
        action = 'REVOKE';
        await revokeUserAccess(event.userId, `Anomalous behavior score: ${anomalyScore}`);
    } else if (usageVelocity > CONFIG.monitoring.maxApiCallsPerMinute) {
        action = 'THROTTLE';
    } 
    
    // Non-Critical Penalties (Context Overlap, Mild Anomalies)
    if (action === 'NONE') {
        if (contextRiskScore >= 100) {
            // Very high context linkage (weighted) → escalate to REVOKE
            action = 'REVOKE';
            await revokeUserAccess(event.userId, `Excessive context overlap score: ${contextRiskScore}`);
        } else if (contextRiskScore >= 50) {
            action = 'WARN';
        } else if (anomalyScore > 50) {
            action = 'WARN';
        }
    }

    if (isRevoked) {
        action = 'BLOCK';
    }

    return {
        userId: event.userId,
        usageVelocity,
        anomalyScore,
        contextRiskScore,
        isRevoked: isRevoked || action === 'REVOKE',
        action,
    };
}

// ─── Resolve Account Status ──────────────────────────────────
// Determines effective account status, auto-detecting expired trials
function resolveAccountStatus(
    status: string | null | undefined,
    trialExpiresAt: string | null | undefined
): AccountStatus {
    if (status === 'paid') return 'paid';
    if (status === 'trial_expired') return 'trial_expired';

    // Auto-detect expired trial
    if (trialExpiresAt) {
        const expiresAt = new Date(trialExpiresAt);
        if (expiresAt < new Date()) return 'trial_expired';
    }

    return 'trial_active';
}

// ─── Get Anchor Age ──────────────────────────────────────────
// Returns age of an anchor in milliseconds, or null if not found
async function getAnchorAge(userId: string, anchorHash: string): Promise<number | null> {
    try {
        const { data } = await supabaseAdmin
            .from('ts_identity_anchors')
            .select('first_seen')
            .eq('user_id', userId)
            .eq('anchor_hash', anchorHash)
            .single();

        if (data?.first_seen) {
            return Date.now() - new Date(data.first_seen).getTime();
        }
    } catch { /* non-fatal */ }
    return null;
}

// ─── Anomaly Score Calculation ────────────────────────────────
async function calculateAnomalyScore(userId: string, currentVelocity: number): Promise<number> {
    try {
        const since = hoursAgo(24).toISOString();
        const { data: events } = await supabaseAdmin
            .from('ts_monitor_events')
            .select('created_at')
            .eq('user_id', userId)
            .gte('created_at', since)
            .order('created_at', { ascending: true });

        if (!events || events.length < 10) return 0;

        const minuteBuckets: Record<string, number> = {};
        events.forEach(e => {
            const minute = e.created_at.substring(0, 16);
            minuteBuckets[minute] = (minuteBuckets[minute] || 0) + 1;
        });

        const values = Object.values(minuteBuckets);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const stdDev = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);

        if (stdDev === 0) return 0;

        const zScore = (currentVelocity - mean) / stdDev;
        if (zScore <= CONFIG.monitoring.anomalyThreshold) return 0;
        return Math.min(100, Math.round((zScore / 5) * 100));
    } catch {
        return 0;
    }
}

// ─── Revoked Status Management ───────────────────────────────
async function checkRevokedStatus(userId: string): Promise<{
    isRevoked: boolean;
    organizationId?: string;
    accountStatus?: AccountStatus;
}> {
    try {
        const { data } = await supabaseAdmin
            .from('ts_users')
            .select('is_quarantined, metadata, account_status, trial_expires_at')
            .eq('id', userId)
            .single();

        return {
            isRevoked: data?.is_quarantined || false,
            organizationId: (data?.metadata as Record<string, string>)?.organizationId,
            accountStatus: data ? resolveAccountStatus(data.account_status, data.trial_expires_at) : undefined,
        };
    } catch {
        return { isRevoked: false };
    }
}

// ─── Get User Usage Stats ────────────────────────────────────
export async function getUserUsageStats(userId: string): Promise<{
    totalEvents: number;
    eventsLastHour: number;
    eventsLastDay: number;
    topEventTypes: { type: string; count: number }[];
}> {
    try {
        const { count: totalEvents } = await supabaseAdmin
            .from('ts_monitor_events')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        const { count: eventsLastHour } = await supabaseAdmin
            .from('ts_monitor_events')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', hoursAgo(1).toISOString());

        const { count: eventsLastDay } = await supabaseAdmin
            .from('ts_monitor_events')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', hoursAgo(24).toISOString());

        return {
            totalEvents: totalEvents || 0,
            eventsLastHour: eventsLastHour || 0,
            eventsLastDay: eventsLastDay || 0,
            topEventTypes: [],
        };
    } catch {
        return { totalEvents: 0, eventsLastHour: 0, eventsLastDay: 0, topEventTypes: [] };
    }
}
