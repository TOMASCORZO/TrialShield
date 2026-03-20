// TrialShield — Content Fingerprinting Service (v3)
// Trial-aware content reuse detection with fuzzy matching, temporal velocity,
// content cluster analysis, and collaborator vs duplicate differentiation.

import {
    ContentType, ContentFingerprint, ContentReuseResult,
    RiskSignal, TrackRequest, AccountStatus, CollaboratorAnalysis,
    CollaboratorSignal,
} from '@/types';
import { CONFIG } from '@/config';
import { supabaseAdmin } from '@/lib/supabase';
import { sha256 } from '@/lib/utils';

// ─── Track Content ───────────────────────────────────────────
// Record that a user created/uploaded/referenced content
export async function trackContent(
    userId: string,
    contentType: ContentType,
    contentValue: string,
    apiKeyId?: string,
    options?: {
        originalValue?: string;
        fileSize?: number;
        metadata?: Record<string, unknown>;
    }
): Promise<ContentReuseResult> {
    const contentHash = sha256(contentValue);

    // 1. Check if THIS user already has this content
    try {
        const { data: existing } = await supabaseAdmin
            .from('ts_content_fingerprints')
            .select('id, times_seen')
            .eq('user_id', userId)
            .eq('content_type', contentType)
            .eq('content_hash', contentHash)
            .single();

        if (existing) {
            // Update existing
            await supabaseAdmin
                .from('ts_content_fingerprints')
                .update({
                    last_seen: new Date().toISOString(),
                    times_seen: existing.times_seen + 1,
                })
                .eq('id', existing.id);
        } else {
            // Insert new
            await supabaseAdmin
                .from('ts_content_fingerprints')
                .insert({
                    user_id: userId,
                    content_type: contentType,
                    content_hash: contentHash,
                    api_key_id: apiKeyId || null,
                    original_value: options?.originalValue || contentValue.substring(0, 200),
                    file_size: options?.fileSize,
                    metadata: options?.metadata || {},
                });
        }
    } catch (err) {
        console.error('[TrialShield] Failed to track content:', err);
    }

    // 2. Check content reuse by OTHER users (trial-aware)
    return checkContentReuse(userId, contentType, contentHash, apiKeyId);
}

// ─── Fetch Account Status ────────────────────────────────────
// Get account_status for a user (trial_active, trial_expired, paid)
async function fetchAccountStatus(userId: string): Promise<AccountStatus> {
    try {
        const { data } = await supabaseAdmin
            .from('ts_users')
            .select('account_status, trial_expires_at')
            .eq('id', userId)
            .single();

        if (!data) return 'trial_active'; // Default assumption

        // Auto-detect expired trial if trial_expires_at is set and past
        if (data.account_status === 'trial_active' && data.trial_expires_at) {
            const expiresAt = new Date(data.trial_expires_at);
            if (expiresAt < new Date()) {
                // Auto-update to expired
                await supabaseAdmin
                    .from('ts_users')
                    .update({ account_status: 'trial_expired' })
                    .eq('id', userId);
                return 'trial_expired';
            }
        }

        return (data.account_status as AccountStatus) || 'trial_active';
    } catch {
        return 'trial_active';
    }
}

// ─── Check Content Reuse (Trial-Aware) ──────────────────────
// See if this content hash exists for any other user, respecting account status
export async function checkContentReuse(
    currentUserId: string,
    contentType: ContentType,
    contentHash: string,
    apiKeyId?: string
): Promise<ContentReuseResult> {
    try {
        const { data: matches, count } = await supabaseAdmin
            .from('ts_content_fingerprints')
            .select('user_id, original_value, first_seen', { count: 'exact' })
            .eq('content_hash', contentHash)
            .eq('api_key_id', apiKeyId || '') // Enforce multi-tenancy
            .neq('user_id', currentUserId)
            .order('first_seen', { ascending: true })
            .limit(10); // Fetch more for status checking

        if (matches && matches.length > 0) {
            const weight = CONFIG.matchScoring.contentWeights[
                contentType as keyof typeof CONFIG.matchScoring.contentWeights
            ] || 0.3;

            // Check each matched user's account status
            for (const match of matches) {
                const matchedStatus = await fetchAccountStatus(match.user_id);

                // ─── PAID USER → SKIP (exempt from comparison) ──────
                if (matchedStatus === 'paid') {
                    return {
                        isReused: false,
                        originalUserId: match.user_id,
                        contentType,
                        originalValue: match.original_value,
                        matchBoost: 0,
                        totalReuseCount: count || 1,
                        skippedReason: 'paid_user',
                        matchedAccountStatus: 'paid',
                    };
                }

                // ─── TRIAL ACTIVE → Analyze collaborator vs duplicate ──
                if (matchedStatus === 'trial_active') {
                    const collabAnalysis = await analyzeCollabVsDuplicate(
                        currentUserId, match.user_id
                    );

                    if (!collabAnalysis.isDuplicate) {
                        // Likely a collaborator — skip penalty
                        return {
                            isReused: false,
                            originalUserId: match.user_id,
                            contentType,
                            originalValue: match.original_value,
                            matchBoost: 0,
                            totalReuseCount: count || 1,
                            skippedReason: 'collaborator',
                            matchedAccountStatus: 'trial_active',
                        };
                    }

                    // Is a duplicate even with trial_active — apply reduced penalty
                    const reducedWeight = weight * CONFIG.collaboratorFactors.trialActiveMultiplier;
                    return {
                        isReused: true,
                        originalUserId: match.user_id,
                        contentType,
                        originalValue: match.original_value,
                        matchBoost: Math.round(reducedWeight * 100),
                        totalReuseCount: count || 1,
                        matchedAccountStatus: 'trial_active',
                    };
                }

                // ─── TRIAL EXPIRED → Full penalty (current behavior) ──
                return {
                    isReused: true,
                    originalUserId: match.user_id,
                    contentType,
                    originalValue: match.original_value,
                    matchBoost: Math.round(weight * 100),
                    totalReuseCount: count || 1,
                    matchedAccountStatus: 'trial_expired',
                };
            }
        }
    } catch (err) {
        console.error('[TrialShield] Content reuse check failed:', err);
    }

    return {
        isReused: false,
        contentType,
        matchBoost: 0,
        totalReuseCount: 0,
    };
}

// ─── Collaborator vs Duplicate Analysis ─────────────────────
// Determines if two users sharing content are collaborators or the same person
export async function analyzeCollabVsDuplicate(
    userA: string,
    userB: string
): Promise<CollaboratorAnalysis> {
    const signals: CollaboratorSignal[] = [];
    const factors = CONFIG.collaboratorFactors;
    let rawScore = 0; // Positive = duplicate, Negative = collaborator

    // 1. Check shared device fingerprint
    try {
        const [{ data: devicesA }, { data: devicesB }] = await Promise.all([
            supabaseAdmin.from('ts_device_graph').select('device_fingerprint_id').eq('user_id', userA),
            supabaseAdmin.from('ts_device_graph').select('device_fingerprint_id').eq('user_id', userB),
        ]);

        if (devicesA && devicesB) {
            const fpSetA = new Set(devicesA.map(d => d.device_fingerprint_id));
            const sharedDevices = devicesB.filter(d => fpSetA.has(d.device_fingerprint_id));

            if (sharedDevices.length > 0) {
                rawScore += factors.sharedDevice;
                signals.push({
                    factor: 'shared_device',
                    weight: factors.sharedDevice,
                    description: `${sharedDevices.length} shared device fingerprint(s) — strong duplicate signal`,
                });
            }
        }
    } catch { /* non-fatal */ }

    // 2. Check shared IP (recent — last 7 days)
    try {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const [{ data: ipsA }, { data: ipsB }] = await Promise.all([
            supabaseAdmin.from('ts_activity_log').select('ip_address').eq('user_id', userA).gte('created_at', since).not('ip_address', 'is', null),
            supabaseAdmin.from('ts_activity_log').select('ip_address').eq('user_id', userB).gte('created_at', since).not('ip_address', 'is', null),
        ]);

        if (ipsA && ipsB) {
            const ipSetA = new Set(ipsA.map(i => i.ip_address));
            const sharedIPs = ipsB.filter(i => ipSetA.has(i.ip_address));

            if (sharedIPs.length > 0) {
                rawScore += factors.sharedIP;
                signals.push({
                    factor: 'shared_ip',
                    weight: factors.sharedIP,
                    description: `Shared IP address detected — could be office or same person`,
                });
            }
        }
    } catch { /* non-fatal */ }

    // 3. Check same organization
    try {
        const [{ data: userDataA }, { data: userDataB }] = await Promise.all([
            supabaseAdmin.from('ts_users').select('metadata, email_domain_hash').eq('id', userA).single(),
            supabaseAdmin.from('ts_users').select('metadata, email_domain_hash').eq('id', userB).single(),
        ]);

        if (userDataA && userDataB) {
            const orgA = (userDataA.metadata as Record<string, any>)?.organizationId;
            const orgB = (userDataB.metadata as Record<string, any>)?.organizationId;

            // Same organization → collaborator
            if (orgA && orgB && String(orgA) === String(orgB)) {
                rawScore += factors.sameOrg;
                signals.push({
                    factor: 'same_org',
                    weight: factors.sameOrg,
                    description: `Both users belong to organization "${orgA}" — likely collaborators`,
                });
            }

            // Same email domain → collaborator
            if (userDataA.email_domain_hash && userDataB.email_domain_hash &&
                userDataA.email_domain_hash === userDataB.email_domain_hash) {
                rawScore += factors.sameEmailDomain;
                signals.push({
                    factor: 'same_email_domain',
                    weight: factors.sameEmailDomain,
                    description: `Same email domain — likely from same company/team`,
                });
            }
        }
    } catch { /* non-fatal */ }

    // 4. Check simultaneous activity (within 5 minutes in the last 24h)
    try {
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const [{ data: actA }, { data: actB }] = await Promise.all([
            supabaseAdmin.from('ts_activity_log').select('created_at').eq('user_id', userA).gte('created_at', since24h).order('created_at').limit(50),
            supabaseAdmin.from('ts_activity_log').select('created_at').eq('user_id', userB).gte('created_at', since24h).order('created_at').limit(50),
        ]);

        if (actA && actB && actA.length > 0 && actB.length > 0) {
            let simultaneousCount = 0;
            for (const a of actA) {
                const aTime = new Date(a.created_at).getTime();
                for (const b of actB) {
                    const bTime = new Date(b.created_at).getTime();
                    // If both active within 5 minutes of each other
                    if (Math.abs(aTime - bTime) < 5 * 60 * 1000) {
                        simultaneousCount++;
                        break;
                    }
                }
            }
            if (simultaneousCount >= 3) {
                rawScore += factors.simultaneousActivity;
                signals.push({
                    factor: 'simultaneous_activity',
                    weight: factors.simultaneousActivity,
                    description: `${simultaneousCount} simultaneous activity windows — suspicious for same person`,
                });
            }
        }
    } catch { /* non-fatal */ }

    // 5. Content overlap analysis — complementary vs identical
    try {
        const [{ data: contentA }, { data: contentB }] = await Promise.all([
            supabaseAdmin.from('ts_content_fingerprints').select('content_type, content_hash').eq('user_id', userA),
            supabaseAdmin.from('ts_content_fingerprints').select('content_type, content_hash').eq('user_id', userB),
        ]);

        if (contentA && contentB && contentA.length > 0 && contentB.length > 0) {
            const hashesA = new Set(contentA.map(c => c.content_hash));
            const hashesB = new Set(contentB.map(c => c.content_hash));
            const shared = [...hashesA].filter(h => hashesB.has(h));
            const totalUnique = new Set([...hashesA, ...hashesB]).size;
            const overlapRatio = totalUnique > 0 ? shared.length / totalUnique : 0;

            if (overlapRatio > 0.5) {
                // Heavily overlapping content → duplicate
                rawScore += factors.identicalBehavior;
                signals.push({
                    factor: 'high_content_overlap',
                    weight: factors.identicalBehavior,
                    description: `${Math.round(overlapRatio * 100)}% content overlap — likely same person`,
                });
            } else if (overlapRatio < 0.2 && shared.length > 0) {
                // Low overlap but some shared content → collaborators
                rawScore += factors.complementaryContent;
                signals.push({
                    factor: 'complementary_content',
                    weight: factors.complementaryContent,
                    description: `Only ${Math.round(overlapRatio * 100)}% content overlap — likely collaborators sharing some resources`,
                });
            }
        }
    } catch { /* non-fatal */ }

    // Calculate final scores
    // Clamp rawScore: positive → duplicate, negative → collaborator
    const duplicateScore = Math.min(100, Math.max(0, rawScore));
    const collaboratorScore = Math.min(100, Math.max(0, -rawScore));
    const isDuplicate = duplicateScore >= 30; // Threshold: need at least 30 to call it duplicate

    return {
        isDuplicate,
        duplicateScore,
        collaboratorScore,
        signals,
    };
}

// ─── Content Velocity Check ─────────────────────────────────
// Detects coordinated attacks: same content hash appearing across many users rapidly
export async function checkContentVelocity(
    contentHash: string,
    contentType: ContentType,
    apiKeyId?: string
): Promise<{ isCoordinated: boolean; distinctUsers: number; severity: RiskSignal['severity'] }> {
    try {
        const windowStart = new Date(
            Date.now() - CONFIG.contentVelocity.windowMinutes * 60 * 1000
        ).toISOString();

        const { data } = await supabaseAdmin
            .from('ts_content_fingerprints')
            .select('user_id')
            .eq('content_hash', contentHash)
            .eq('api_key_id', apiKeyId || '') // Tenant isolation
            .gte('first_seen', windowStart);

        if (!data) return { isCoordinated: false, distinctUsers: 0, severity: 'LOW' };

        const distinctUsers = new Set(data.map(d => d.user_id)).size;
        const isCoordinated = distinctUsers > CONFIG.contentVelocity.userThreshold;

        return {
            isCoordinated,
            distinctUsers,
            severity: distinctUsers > 5 ? 'CRITICAL' : isCoordinated ? 'HIGH' : 'LOW',
        };
    } catch {
        return { isCoordinated: false, distinctUsers: 0, severity: 'LOW' };
    }
}

// ─── SimHash for Fuzzy Text Matching ─────────────────────────
// Generates a similarity-preserving hash for text content
// Similar texts will produce similar hashes (low Hamming distance)
export function computeSimHash(text: string, ngramSize: number = 3): string {
    const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
    if (normalized.length < ngramSize) return sha256(normalized);

    // Generate n-grams
    const ngrams: string[] = [];
    for (let i = 0; i <= normalized.length - ngramSize; i++) {
        ngrams.push(normalized.substring(i, i + ngramSize));
    }

    // Build 64-bit SimHash vector
    const bits = 64;
    const vector = new Array(bits).fill(0);

    for (const ngram of ngrams) {
        const hash = sha256(ngram);
        for (let i = 0; i < bits; i++) {
            const charIndex = Math.floor(i / 4);
            const bitPos = i % 4;
            const nibble = parseInt(hash[charIndex] || '0', 16);
            if ((nibble >> bitPos) & 1) {
                vector[i] += 1;
            } else {
                vector[i] -= 1;
            }
        }
    }

    // Convert vector to hex string
    let result = '';
    for (let i = 0; i < bits; i += 4) {
        let nibble = 0;
        for (let j = 0; j < 4 && i + j < bits; j++) {
            if (vector[i + j] > 0) {
                nibble |= (1 << j);
            }
        }
        result += nibble.toString(16);
    }

    return result;
}

// Calculate Hamming distance between two SimHash hex strings
export function simHashDistance(hashA: string, hashB: string): number {
    let distance = 0;
    const len = Math.min(hashA.length, hashB.length);
    for (let i = 0; i < len; i++) {
        const a = parseInt(hashA[i], 16);
        const b = parseInt(hashB[i], 16);
        let xor = a ^ b;
        while (xor) {
            distance += xor & 1;
            xor >>= 1;
        }
    }
    return distance;
}

// ─── Content Cluster Analysis ────────────────────────────────
// Jaccard Index-based content overlap between two users
export async function analyzeContentCluster(
    userId: string,
    apiKeyId?: string
): Promise<{ clusteredUsers: { userId: string; overlapCoefficient: number; sharedCount: number }[] }> {
    const clusteredUsers: { userId: string; overlapCoefficient: number; sharedCount: number }[] = [];

    try {
        // Get all content hashes for this user
        const { data: userContent } = await supabaseAdmin
            .from('ts_content_fingerprints')
            .select('content_hash')
            .eq('user_id', userId);

        if (!userContent || userContent.length === 0) return { clusteredUsers };

        const userHashes = new Set(userContent.map(c => c.content_hash));

        // Find all users who share ANY content hash
        const { data: sharedContent } = await supabaseAdmin
            .from('ts_content_fingerprints')
            .select('user_id, content_hash')
            .eq('api_key_id', apiKeyId || '') // Multi-tenancy isolation
            .in('content_hash', [...userHashes])
            .neq('user_id', userId);

        if (!sharedContent) return { clusteredUsers };

        // Group by user
        const userContentMap = new Map<string, Set<string>>();
        for (const item of sharedContent) {
            if (!userContentMap.has(item.user_id)) {
                userContentMap.set(item.user_id, new Set());
            }
            userContentMap.get(item.user_id)!.add(item.content_hash);
        }

        // Calculate Jaccard Index for each related user
        for (const [otherUserId, otherHashes] of userContentMap.entries()) {
            const shared = [...userHashes].filter(h => otherHashes.has(h));
            const union = new Set([...userHashes, ...otherHashes]);
            const jaccardIndex = union.size > 0 ? shared.length / union.size : 0;

            if (shared.length > 0) {
                clusteredUsers.push({
                    userId: otherUserId,
                    overlapCoefficient: Math.round(jaccardIndex * 100) / 100,
                    sharedCount: shared.length,
                });
            }
        }

        // Sort by overlap descending
        clusteredUsers.sort((a, b) => b.overlapCoefficient - a.overlapCoefficient);
    } catch (err) {
        console.error('[TrialShield] Content cluster analysis failed:', err);
    }

    return { clusteredUsers };
}

// ─── Process Track Request Content ───────────────────────────
// Extract all content fingerprints from a track request and check for reuse
export async function processTrackContent(
    userId: string,
    request: TrackRequest,
    apiKeyId?: string
): Promise<{ reuseResults: ContentReuseResult[]; signals: RiskSignal[] }> {
    const reuseResults: ContentReuseResult[] = [];
    const signals: RiskSignal[] = [];
    const meta = request.metadata;

    if (!meta) return { reuseResults, signals };

    // ─── File hash tracking ──────────────────────────────────
    if (meta.fileHash) {
        const result = await trackContent(userId, 'file_hash', meta.fileHash, apiKeyId, {
            originalValue: meta.fileName,
            fileSize: meta.fileSize,
        });
        reuseResults.push(result);
        if (result.isReused) {
            // Check velocity for coordinated attacks
            const velocity = await checkContentVelocity(sha256(meta.fileHash), 'file_hash', apiKeyId);
            const severity = velocity.isCoordinated ? 'CRITICAL' : 'CRITICAL';

            signals.push({
                module: 'GRAPH',
                signal: 'CONTENT_REUSE_FILE',
                severity,
                description: `File "${meta.fileName || 'unknown'}" was previously uploaded by another user${
                    result.matchedAccountStatus === 'trial_active' ? ' (active trial, reduced penalty)' : ''
                }${velocity.isCoordinated ? ` — COORDINATED: ${velocity.distinctUsers} users in ${CONFIG.contentVelocity.windowMinutes}min` : ''}`,
                value: result.matchBoost,
            });
        } else if (result.skippedReason) {
            signals.push({
                module: 'GRAPH',
                signal: 'CONTENT_MATCH_SKIPPED',
                severity: 'LOW',
                description: `File match skipped: ${result.skippedReason} (user ${result.originalUserId})`,
                value: 0,
            });
        }
    }

    // ─── Image hash tracking ─────────────────────────────────
    if (meta.imageHash) {
        const result = await trackContent(userId, 'image_hash', meta.imageHash, apiKeyId, {
            originalValue: meta.fileName,
        });
        reuseResults.push(result);
        if (result.isReused) {
            signals.push({
                module: 'GRAPH',
                signal: 'CONTENT_REUSE_IMAGE',
                severity: 'HIGH',
                description: `Image "${meta.fileName || 'unknown'}" matches content from another user${
                    result.matchedAccountStatus === 'trial_active' ? ' (active trial)' : ''
                }`,
                value: result.matchBoost,
            });
        }
    }

    // ─── Project name tracking ───────────────────────────────
    if (meta.projectName) {
        const result = await trackContent(userId, 'project_name', meta.projectName.toLowerCase().trim(), apiKeyId, {
            originalValue: meta.projectName,
        });
        reuseResults.push(result);
        if (result.isReused) {
            signals.push({
                module: 'GRAPH',
                signal: 'CONTENT_REUSE_PROJECT',
                severity: 'HIGH',
                description: `Project name "${meta.projectName}" matches another user's project`,
                value: result.matchBoost,
            });
        }
    }

    // ─── GitHub link tracking ────────────────────────────────
    if (meta.githubLink) {
        const normalizedUrl = normalizeGithubUrl(meta.githubLink);
        const result = await trackContent(userId, 'github_link', normalizedUrl, apiKeyId, {
            originalValue: meta.githubLink,
        });
        reuseResults.push(result);
        if (result.isReused) {
            signals.push({
                module: 'GRAPH',
                signal: 'CONTENT_REUSE_GITHUB_LINK',
                severity: result.matchedAccountStatus === 'trial_expired' ? 'CRITICAL' : 'HIGH',
                description: `GitHub link "${meta.githubLink}" was referenced by another user`,
                value: result.matchBoost,
            });
        }
    }

    // ─── GitHub repo tracking ────────────────────────────────
    if (meta.githubRepo) {
        const normalizedRepo = meta.githubRepo.toLowerCase().trim();
        const result = await trackContent(userId, 'github_repo', normalizedRepo, apiKeyId, {
            originalValue: meta.githubRepo,
        });
        reuseResults.push(result);
        if (result.isReused) {
            signals.push({
                module: 'GRAPH',
                signal: 'CONTENT_REUSE_GITHUB_REPO',
                severity: result.matchedAccountStatus === 'trial_expired' ? 'CRITICAL' : 'HIGH',
                description: `GitHub repo "${meta.githubRepo}" is associated with another user`,
                value: result.matchBoost,
            });
        }
    }

    // ─── AI query tracking ───────────────────────────────────
    if (meta.query) {
        // Exact match tracking
        const normalizedQuery = normalizeAiQuery(meta.query);
        const result = await trackContent(userId, 'ai_query', normalizedQuery, apiKeyId, {
            originalValue: meta.query.substring(0, 100),
            metadata: { sessionId: meta.sessionId },
        });
        reuseResults.push(result);
        if (result.isReused) {
            signals.push({
                module: 'GRAPH',
                signal: 'CONTENT_REUSE_AI_QUERY',
                severity: 'MEDIUM',
                description: 'AI query matches content from another user',
                value: result.matchBoost,
            });
        }

        // Fuzzy match via SimHash (for longer queries)
        if (meta.query.length > 50) {
            const simHash = computeSimHash(meta.query);
            const fuzzyResult = await trackContent(userId, 'simhash', simHash, apiKeyId, {
                originalValue: `SimHash of: ${meta.query.substring(0, 60)}...`,
                metadata: { originalLength: meta.query.length },
            });
            if (fuzzyResult.isReused) {
                signals.push({
                    module: 'GRAPH',
                    signal: 'CONTENT_FUZZY_MATCH_QUERY',
                    severity: 'MEDIUM',
                    description: 'AI query is highly similar to another user\'s query (fuzzy match)',
                    value: fuzzyResult.matchBoost,
                });
            }
        }
    }

    // ─── AI session tracking ─────────────────────────────────
    if (meta.sessionId) {
        const result = await trackContent(userId, 'ai_session', meta.sessionId, apiKeyId, {
            originalValue: `Session: ${meta.sessionId}`,
        });
        reuseResults.push(result);
        if (result.isReused) {
            signals.push({
                module: 'GRAPH',
                signal: 'CONTENT_REUSE_AI_SESSION',
                severity: 'HIGH',
                description: 'AI session ID matches another user — probable account sharing',
                value: result.matchBoost,
            });
        }
    }

    // ─── GitHub user extraction ──────────────────────────────
    if (meta.githubLink) {
        const githubUser = extractGithubUser(meta.githubLink);
        if (githubUser) {
            const result = await trackContent(userId, 'github_repo', `user:${githubUser}`, apiKeyId, {
                originalValue: `GitHub user: ${githubUser}`,
            });
            if (result.isReused) {
                signals.push({
                    module: 'GRAPH',
                    signal: 'CONTENT_REUSE_GITHUB_USER',
                    severity: result.matchedAccountStatus === 'trial_expired' ? 'CRITICAL' : 'HIGH',
                    description: `GitHub user "${githubUser}" is linked to another trial account`,
                    value: result.matchBoost,
                });
            }
        }
    }

    // ─── Text snippet tracking (exact + fuzzy) ───────────────
    if (meta.contentSnippet && meta.contentSnippet.length > 20) {
        const normalizedSnippet = meta.contentSnippet.toLowerCase().replace(/\s+/g, ' ').trim();

        // Exact match
        const result = await trackContent(userId, 'text_snippet', normalizedSnippet, apiKeyId, {
            originalValue: meta.contentSnippet.substring(0, 200),
        });
        reuseResults.push(result);
        if (result.isReused) {
            signals.push({
                module: 'GRAPH',
                signal: 'CONTENT_REUSE_TEXT',
                severity: 'MEDIUM',
                description: 'Text content matches submission from another user',
                value: result.matchBoost,
            });
        }

        // Fuzzy match for longer snippets
        if (meta.contentSnippet.length > 80) {
            const simHash = computeSimHash(meta.contentSnippet);
            const fuzzyResult = await trackContent(userId, 'simhash', simHash, apiKeyId, {
                originalValue: `SimHash of text: ${meta.contentSnippet.substring(0, 60)}...`,
            });
            if (fuzzyResult.isReused) {
                signals.push({
                    module: 'GRAPH',
                    signal: 'CONTENT_FUZZY_MATCH_TEXT',
                    severity: 'MEDIUM',
                    description: 'Text content is highly similar to another user\'s submission (fuzzy match)',
                    value: fuzzyResult.matchBoost,
                });
            }
        }
    }

    return { reuseResults, signals };
}

// ─── Get User Content Summary (Optimized) ───────────────────
export async function getUserContentSummary(userId: string): Promise<{
    totalItems: number;
    byType: Record<string, number>;
    reusedItems: number;
}> {
    try {
        const { data } = await supabaseAdmin
            .from('ts_content_fingerprints')
            .select('content_type, content_hash')
            .eq('user_id', userId);

        if (!data) return { totalItems: 0, byType: {}, reusedItems: 0 };

        const byType: Record<string, number> = {};
        for (const item of data) {
            byType[item.content_type] = (byType[item.content_type] || 0) + 1;
        }

        // Batch query: find all hashes used by other users in a single query
        const hashes = [...new Set(data.map(d => d.content_hash))];
        let reusedItems = 0;

        if (hashes.length > 0) {
            const { data: sharedContent } = await supabaseAdmin
                .from('ts_content_fingerprints')
                .select('content_hash')
                // .eq('api_key_id', apiKeyId || '') => Note: this function lacks apiKeyId context but we could upgrade it later if queried globally
                .in('content_hash', hashes)
                .neq('user_id', userId);

            if (sharedContent) {
                const sharedHashes = new Set(sharedContent.map(s => s.content_hash));
                reusedItems = data.filter(d => sharedHashes.has(d.content_hash)).length;
            }
        }

        return { totalItems: data.length, byType, reusedItems };
    } catch {
        return { totalItems: 0, byType: {}, reusedItems: 0 };
    }
}

// ─── Get Content Overlap Between Two Users ───────────────────
export async function getContentOverlap(
    userId1: string,
    userId2: string,
    apiKeyId: string
): Promise<{ sharedHashes: string[]; overlapPercentage: number }> {
    try {
        const [{ data: content1 }, { data: content2 }] = await Promise.all([
            supabaseAdmin.from('ts_content_fingerprints').select('content_hash').eq('user_id', userId1).eq('api_key_id', apiKeyId || ''),
            supabaseAdmin.from('ts_content_fingerprints').select('content_hash').eq('user_id', userId2).eq('api_key_id', apiKeyId || ''),
        ]);

        if (!content1 || !content2) return { sharedHashes: [], overlapPercentage: 0 };

        const hashes1 = new Set(content1.map(c => c.content_hash));
        const hashes2 = new Set(content2.map(c => c.content_hash));

        const shared = [...hashes1].filter(h => hashes2.has(h));
        const totalUnique = new Set([...hashes1, ...hashes2]).size;

        return {
            sharedHashes: shared,
            overlapPercentage: totalUnique > 0 ? Math.round((shared.length / totalUnique) * 100) : 0,
        };
    } catch {
        return { sharedHashes: [], overlapPercentage: 0 };
    }
}

// ─── Helpers ─────────────────────────────────────────────────

function normalizeGithubUrl(url: string): string {
    let normalized = url.toLowerCase().trim()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '')
        .replace(/\?.*$/, '')
        .replace(/#.*$/, '');

    if (normalized.startsWith('github.com/')) {
        const parts = normalized.replace('github.com/', '').split('/');
        if (parts.length >= 2) {
            normalized = `github.com/${parts[0]}/${parts[1]}`;
        }
    }
    return normalized;
}

function extractGithubUser(url: string): string | null {
    const match = url.match(/github\.com\/([a-zA-Z0-9_-]+)/);
    return match ? match[1].toLowerCase() : null;
}

function normalizeAiQuery(query: string): string {
    return query.toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^(please |can you |could you |i want to |i need to )/i, '')
        .trim();
}
