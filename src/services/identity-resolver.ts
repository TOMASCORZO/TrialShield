// TrialShield — Identity Resolution Service (v2)
// Persistent user identity tracking across devices, IPs, emails, phones, cards
// Every signal becomes an "anchor" that links to a user identity

import {
    AnchorType, IdentityAnchor, IdentityResolution,
    MatchResult, MatchBreakdown, MatchedUser, RiskSignal,
    ClientSettings, EnforcementAction, Sensitivity,
} from '@/types';
import { CONFIG } from '@/config';
import { supabaseAdmin } from '@/lib/supabase';
import { sha256, generateId } from '@/lib/utils';

// ─── Resolve Identity ────────────────────────────────────────
// Given any combination of signals, find or create the user
export async function resolveIdentity(
    anchors: { type: AnchorType; value: string }[],
    apiKeyId?: string,
    metadata?: Record<string, unknown>
): Promise<IdentityResolution> {
    const signals: RiskSignal[] = [];
    const matchedAnchors: IdentityAnchor[] = [];
    const matchedUserIds = new Set<string>();

    // Hash all anchors
    const hashedAnchors = anchors.map(a => ({
        type: a.type,
        hash: sha256(a.value),
        original: a.value,
    }));

    // 1. Search existing anchors for ALL provided signals — SCOPED BY api_key_id
    for (const anchor of hashedAnchors) {
        try {
            let query = supabaseAdmin
                .from('ts_identity_anchors')
                .select('user_id, anchor_type, anchor_hash, confidence, first_seen, last_seen, times_seen')
                .eq('anchor_type', anchor.type)
                .eq('anchor_hash', anchor.hash);

            // Multi-tenancy: scope to this client's users only
            if (apiKeyId) {
                query = query.eq('api_key_id', apiKeyId);
            }

            const { data: existing } = await query;

            if (existing && existing.length > 0) {
                for (const row of existing) {
                    matchedUserIds.add(row.user_id);
                    matchedAnchors.push({
                        userId: row.user_id,
                        anchorType: row.anchor_type as AnchorType,
                        anchorHash: row.anchor_hash,
                        confidence: row.confidence,
                        firstSeen: row.first_seen,
                        lastSeen: row.last_seen,
                        timesSeen: row.times_seen,
                    });
                }
            }
        } catch (err) {
            console.error(`[TrialShield] Anchor lookup failed for ${anchor.type}:`, err);
        }
    }

    // 2. Determine the primary user based ONLY on STRONG anchors (email, phone, github, card)
    // Weak anchors (IP, device fingerprint) imply a relationship/duplicate, not the exact same user.
    const strongAnchorTypes = ['email', 'phone', 'github_account', 'card_fingerprint'];
    const strongMatches = matchedAnchors.filter(a => strongAnchorTypes.includes(a.anchorType));
    
    let resolvedUserId: string;
    let isNewUser = false;

    if (strongMatches.length > 0) {
        // Find the user with the most STRONG anchor matches
        const userCounts = new Map<string, number>();
        for (const anchor of strongMatches) {
            userCounts.set(anchor.userId, (userCounts.get(anchor.userId) || 0) + 1);
        }
        resolvedUserId = [...userCounts.entries()]
            .sort((a, b) => b[1] - a[1])[0][0];

        // If multiple users matched strong anchors, flag it
        const uniqueStrongUsers = new Set(strongMatches.map(a => a.userId));
        if (uniqueStrongUsers.size > 1) {
            signals.push({
                module: 'GRAPH',
                signal: 'MULTI_USER_ANCHOR_MATCH',
                severity: 'CRITICAL',
                description: `Signals match ${matchedUserIds.size} different existing users — probable trial abuse`,
                value: uniqueStrongUsers.size,
            });
        }

        // Update existing user with metadata if provided (e.g. they joined an organization)
        if (metadata && Object.keys(metadata).length > 0) {
            await supabaseAdmin.from('ts_users').update({ metadata }).eq('id', resolvedUserId);
        }

    } else {
        // No strong anchors matched — create new user identity.
        // Even if device/IP matches an old user, this is a NEW account (duplicate attempt).
        const { data: newUser } = await supabaseAdmin
            .from('ts_users')
            .insert({
                highest_risk_score: 0,
                last_decision: 'ALLOW',
                api_key_id: apiKeyId || null,  // Multi-tenancy: tag user to client
                metadata: metadata || {},
            })
            .select('id')
            .single();

        resolvedUserId = newUser?.id || generateId();
        isNewUser = true;
    }

    // 3. Link all anchors to the resolved user (upsert)
    for (const anchor of hashedAnchors) {
        await linkAnchor(resolvedUserId, anchor.type, anchor.hash);
    }

    // 4. Calculate match score
    const matchScore = await calculateMatchScore(resolvedUserId, hashedAnchors, matchedAnchors);

    return {
        resolvedUserId,
        isNewUser,
        matchedAnchors,
        matchScore: matchScore.score,
        matchedToUsers: [...matchedUserIds].filter(id => id !== resolvedUserId),
    };
}

// ─── Link Anchor ─────────────────────────────────────────────
// Associate a signal with a user identity
export async function linkAnchor(
    userId: string,
    anchorType: AnchorType,
    anchorHash: string,
    confidence: number = 1.0
): Promise<void> {
    try {
        // Try to upsert — increment times_seen if exists
        const { data: existing } = await supabaseAdmin
            .from('ts_identity_anchors')
            .select('id, times_seen')
            .eq('user_id', userId)
            .eq('anchor_type', anchorType)
            .eq('anchor_hash', anchorHash)
            .single();

        if (existing) {
            await supabaseAdmin
                .from('ts_identity_anchors')
                .update({
                    last_seen: new Date().toISOString(),
                    times_seen: existing.times_seen + 1,
                    confidence: Math.min(1.0, confidence),
                })
                .eq('id', existing.id);
        } else {
            await supabaseAdmin
                .from('ts_identity_anchors')
                .insert({
                    user_id: userId,
                    anchor_type: anchorType,
                    anchor_hash: anchorHash,
                    confidence,
                });
        }
    } catch (err) {
        console.error('[TrialShield] Failed to link anchor:', err);
    }
}

// ─── Calculate Match Score ───────────────────────────────────
// Computes a 0-100% match confidence based on anchor overlaps
// Uses the formula: 1 - Π(1 - weight_i) for compounding weights
export async function calculateMatchScore(
    userId: string,
    currentAnchors: { type: AnchorType; hash: string }[],
    matchedAnchors: IdentityAnchor[]
): Promise<MatchResult> {
    const weights = CONFIG.matchScoring.anchorWeights;
    const breakdown: MatchBreakdown = {
        deviceMatch: 0, emailMatch: 0, phoneMatch: 0,
        ipMatch: 0, cardMatch: 0, cardLast4ZipMatch: 0,
        cardFingerprintMatch: 0, cardNameMatch: 0, billingZipMatch: 0, cardCountryMatch: 0,
        browserMatch: 0,
        contentMatch: 0, aiSessionMatch: 0, githubMatch: 0,
    };
    const matchedUsers = new Map<string, { anchors: Set<AnchorType>; contents: Set<string> }>();

    // 1. Score anchor matches against OTHER users
    const otherUserAnchors = matchedAnchors.filter(a => a.userId !== userId);

    for (const anchor of otherUserAnchors) {
        const weight = weights[anchor.anchorType as keyof typeof weights] || 0.3;
        const scoreContribution = Math.round(weight * 100);

        // Track per-dimension
        switch (anchor.anchorType) {
            case 'device': breakdown.deviceMatch = Math.max(breakdown.deviceMatch, scoreContribution); break;
            case 'email': breakdown.emailMatch = Math.max(breakdown.emailMatch, scoreContribution); break;
            case 'phone': breakdown.phoneMatch = Math.max(breakdown.phoneMatch, scoreContribution); break;
            case 'ip': breakdown.ipMatch = Math.max(breakdown.ipMatch, scoreContribution); break;
            case 'card_fingerprint': breakdown.cardFingerprintMatch = Math.max(breakdown.cardFingerprintMatch, scoreContribution); break;
            case 'card_bin_last4': breakdown.cardMatch = Math.max(breakdown.cardMatch, scoreContribution); break;
            case 'card_last4_zip': breakdown.cardLast4ZipMatch = Math.max(breakdown.cardLast4ZipMatch, scoreContribution); break;
            case 'card_bin': breakdown.cardMatch = Math.max(breakdown.cardMatch, scoreContribution); break;
            case 'card_name': breakdown.cardNameMatch = Math.max(breakdown.cardNameMatch, scoreContribution); break;
            case 'billing_zip': breakdown.billingZipMatch = Math.max(breakdown.billingZipMatch, scoreContribution); break;
            case 'card_country': breakdown.cardCountryMatch = Math.max(breakdown.cardCountryMatch, scoreContribution); break;
            case 'browser_fp': breakdown.browserMatch = Math.max(breakdown.browserMatch, scoreContribution); break;
            case 'github_account': breakdown.githubMatch = Math.max(breakdown.githubMatch, scoreContribution); break;
        }

        // Track matched users
        if (!matchedUsers.has(anchor.userId)) {
            matchedUsers.set(anchor.userId, { anchors: new Set(), contents: new Set() });
        }
        matchedUsers.get(anchor.userId)!.anchors.add(anchor.anchorType);
    }

    // 2. Check content fingerprint overlaps
    try {
        const contentMatch = await getContentOverlapScore(userId);
        breakdown.contentMatch = contentMatch.contentScore;
        breakdown.aiSessionMatch = contentMatch.aiScore;
        breakdown.githubMatch = Math.max(breakdown.githubMatch, contentMatch.githubScore);
    } catch (err) {
        console.error('[TrialShield] Content overlap check failed:', err);
    }

    // 3. Calculate combined score using compound probability
    // Formula: 1 - Π(1 - weight_i) — each matching anchor increases confidence
    const activeWeights: number[] = [];
    if (breakdown.deviceMatch > 0) activeWeights.push(weights.device);
    if (breakdown.emailMatch > 0) activeWeights.push(weights.email);
    if (breakdown.phoneMatch > 0) activeWeights.push(weights.phone);
    if (breakdown.ipMatch > 0) activeWeights.push(weights.ip);
    if (breakdown.cardFingerprintMatch > 0) activeWeights.push(weights.card_fingerprint);
    if (breakdown.cardMatch > 0) {
        // Since breakdown.cardMatch stores both bin and bin_last4 updates, we need to push the right weight.
        // We know what weight was contributed based on the max value. 
        activeWeights.push(breakdown.cardMatch / 100); 
    }
    if (breakdown.cardLast4ZipMatch > 0) activeWeights.push(weights.card_last4_zip);
    if (breakdown.cardNameMatch > 0) activeWeights.push(weights.card_name);
    if (breakdown.billingZipMatch > 0) activeWeights.push(weights.billing_zip);
    if (breakdown.cardCountryMatch > 0) activeWeights.push(weights.card_country);
    if (breakdown.browserMatch > 0) activeWeights.push(weights.browser_fp);
    if (breakdown.githubMatch > 0) activeWeights.push(weights.github_account);

    // Content weights
    const cw = CONFIG.matchScoring.contentWeights;
    if (breakdown.contentMatch > 0) activeWeights.push(cw.file_hash);
    if (breakdown.aiSessionMatch > 0) activeWeights.push(cw.ai_session);

    let combinedScore: number;
    if (activeWeights.length === 0) {
        combinedScore = 0;
    } else {
        // Compound probability: 1 - (1-w1)(1-w2)...(1-wn)
        const survivalProbability = activeWeights.reduce((acc, w) => acc * (1 - w), 1);
        combinedScore = Math.round((1 - survivalProbability) * 100);
    }

    // Build matched user list
    const matchedUserList: MatchedUser[] = [...matchedUsers.entries()].map(([uid, data]) => ({
        userId: uid,
        matchScore: combinedScore,
        sharedAnchors: [...data.anchors],
        sharedContent: [...data.contents] as any,
    }));

    return {
        score: Math.min(100, combinedScore),
        breakdown,
        matchedUsers: matchedUserList,
        isAbuser: false, // Determined by caller using client threshold
    };
}

// ─── Content Overlap Scoring ─────────────────────────────────
async function getContentOverlapScore(userId: string): Promise<{
    contentScore: number;
    aiScore: number;
    githubScore: number;
}> {
    let contentScore = 0;
    let aiScore = 0;
    let githubScore = 0;

    try {
        // Get all content hashes for this user
        const { data: userContent } = await supabaseAdmin
            .from('ts_content_fingerprints')
            .select('content_type, content_hash')
            .eq('user_id', userId);

        if (!userContent || userContent.length === 0) {
            return { contentScore, aiScore, githubScore };
        }

        // Check each content hash against other users
        for (const content of userContent) {
            const { count } = await supabaseAdmin
                .from('ts_content_fingerprints')
                .select('*', { count: 'exact', head: true })
                .eq('content_hash', content.content_hash)
                .neq('user_id', userId);

            if (count && count > 0) {
                const weight = CONFIG.matchScoring.contentWeights[
                    content.content_type as keyof typeof CONFIG.matchScoring.contentWeights
                ] || 0.3;

                const contribution = Math.round(weight * 100);

                if (['file_hash', 'image_hash', 'project_name', 'url', 'text_snippet'].includes(content.content_type)) {
                    contentScore = Math.max(contentScore, contribution);
                } else if (['ai_session', 'ai_query'].includes(content.content_type)) {
                    aiScore = Math.max(aiScore, contribution);
                } else if (['github_link', 'github_repo'].includes(content.content_type)) {
                    githubScore = Math.max(githubScore, contribution);
                }
            }
        }
    } catch (err) {
        console.error('[TrialShield] Content overlap scoring failed:', err);
    }

    return { contentScore, aiScore, githubScore };
}

// ─── Get Client Settings ─────────────────────────────────────
export async function getClientSettings(apiKeyId: string): Promise<ClientSettings> {
    try {
        const { data } = await supabaseAdmin
            .from('ts_client_settings')
            .select('*')
            .eq('api_key_id', apiKeyId)
            .single();

        if (data) {
            return {
                apiKeyId,
                sensitivity: data.sensitivity as Sensitivity,
                matchThreshold: data.match_threshold,
                autoRevoke: data.auto_revoke,
                notifyWebhook: data.notify_webhook,
                monitorContent: data.monitor_content,
                monitorAiUsage: data.monitor_ai_usage,
                monitorGithub: data.monitor_github,
            };
        }
    } catch {
        // No settings found, return defaults
    }

    // Default settings
    return {
        apiKeyId,
        sensitivity: 'balanced',
        matchThreshold: CONFIG.matchScoring.presets.balanced,
        autoRevoke: true,
        monitorContent: true,
        monitorAiUsage: true,
        monitorGithub: true,
    };
}

// ─── Evaluate Enforcement ────────────────────────────────────
// Given a match score and client settings, determine what action to take
export function evaluateEnforcement(
    matchScore: number,
    settings: ClientSettings,
    matchedUserId?: string
): EnforcementAction {
    const threshold = settings.matchThreshold;

    if (matchScore >= threshold && settings.autoRevoke) {
        return {
            action: 'REVOKE',
            reason: `Match score ${matchScore}% exceeds threshold ${threshold}% (${settings.sensitivity} mode)`,
            matchScore,
            threshold,
            matchedUserId,
            revokedAt: new Date().toISOString(),
        };
    }

    if (matchScore >= threshold * 0.7) {
        return {
            action: 'WARN',
            reason: `Match score ${matchScore}% approaching threshold ${threshold}%`,
            matchScore,
            threshold,
            matchedUserId,
        };
    }

    if (matchScore >= threshold * 0.4) {
        return {
            action: 'THROTTLE',
            reason: `Moderate match score ${matchScore}% — monitoring closely`,
            matchScore,
            threshold,
            matchedUserId,
        };
    }

    return {
        action: 'NONE',
        reason: 'No match detected',
        matchScore,
        threshold,
    };
}

// ─── Revoke User Access ──────────────────────────────────────
export async function revokeUserAccess(
    userId: string,
    reason: string,
    matchedUserId?: string
): Promise<void> {
    try {
        // Quarantine the user
        await supabaseAdmin
            .from('ts_users')
            .update({
                is_quarantined: true,
                metadata: {
                    revoked_at: new Date().toISOString(),
                    revoke_reason: reason,
                    matched_user_id: matchedUserId,
                },
            })
            .eq('id', userId);

        console.warn(`[TrialShield] User ${userId} REVOKED: ${reason}`);
    } catch (err) {
        console.error('[TrialShield] Failed to revoke user:', err);
    }
}

// ─── Notify Client Webhook ───────────────────────────────────
export async function notifyWebhook(
    webhookUrl: string,
    enforcement: EnforcementAction,
    userId: string
): Promise<void> {
    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event: 'user_enforcement',
                userId,
                ...enforcement,
                timestamp: new Date().toISOString(),
            }),
            signal: AbortSignal.timeout(10000),
        });
    } catch (err) {
        console.error('[TrialShield] Webhook notification failed:', err);
    }
}

// ─── Find All Users Linked by Anchor ─────────────────────────
export async function findLinkedUsers(anchorHash: string): Promise<string[]> {
    try {
        const { data } = await supabaseAdmin
            .from('ts_identity_anchors')
            .select('user_id')
            .eq('anchor_hash', anchorHash);

        if (!data) return [];
        return [...new Set(data.map(d => d.user_id))];
    } catch {
        return [];
    }
}
