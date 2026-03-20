// TrialShield — Duplicate User Identification Engine (v3)
// Centralized service that consolidates ALL identity signals to identify
// duplicate users, differentiate collaborators from abusers, and detect abuse rings.

import {
    AccountStatus, DuplicateClassification, DuplicateCandidate,
    DuplicateReport, CollaboratorAnalysis, RiskSignal, AnchorType,
} from '@/types';
import { CONFIG } from '@/config';
import { supabaseAdmin } from '@/lib/supabase';
import { analyzeCollabVsDuplicate, getContentOverlap, analyzeContentCluster } from './content-fingerprint';

// ─── Identify Duplicates ─────────────────────────────────────
// Main entry point: given a user, find all potential duplicates
// across every dimension (device, IP, email, phone, card, content, context)
export async function identifyDuplicates(userId: string, apiKeyId: string): Promise<DuplicateReport> {
    const candidates = new Map<string, {
        sharedDimensions: Set<string>;
        anchorScores: number[];
    }>();

    // 1. Gather all anchors for this user
    try {
        const { data: userAnchors } = await supabaseAdmin
            .from('ts_identity_anchors')
            .select('anchor_type, anchor_hash')
            .eq('user_id', userId);

        if (userAnchors && userAnchors.length > 0) {
            // For each anchor, find other users who share it
            const anchorHashes = userAnchors.map(a => a.anchor_hash);

            const { data: sharedAnchors } = await supabaseAdmin
                .from('ts_identity_anchors')
                .select('user_id, anchor_type, anchor_hash')
                .eq('api_key_id', apiKeyId)
                .in('anchor_hash', anchorHashes)
                .neq('user_id', userId);

            if (sharedAnchors) {
                for (const anchor of sharedAnchors) {
                    if (!candidates.has(anchor.user_id)) {
                        candidates.set(anchor.user_id, {
                            sharedDimensions: new Set(),
                            anchorScores: [],
                        });
                    }
                    const candidate = candidates.get(anchor.user_id)!;
                    candidate.sharedDimensions.add(anchor.anchor_type);

                    // Get the weight for this anchor type
                    const weight = CONFIG.matchScoring.anchorWeights[
                        anchor.anchor_type as keyof typeof CONFIG.matchScoring.anchorWeights
                    ] || 0.3;
                    candidate.anchorScores.push(weight);
                }
            }
        }
    } catch (err) {
        console.error('[TrialShield] Anchor lookup for duplicates failed:', err);
    }

    // 2. Check content overlap clusters
    try {
        const contentCluster = await analyzeContentCluster(userId, apiKeyId);
        for (const clusteredUser of contentCluster.clusteredUsers) {
            if (!candidates.has(clusteredUser.userId)) {
                candidates.set(clusteredUser.userId, {
                    sharedDimensions: new Set(),
                    anchorScores: [],
                });
            }
            const candidate = candidates.get(clusteredUser.userId)!;
            candidate.sharedDimensions.add(`content:overlap_${clusteredUser.sharedCount}`);

            // Content overlap contributes based on overlap coefficient
            const contentWeight = Math.min(0.9, clusteredUser.overlapCoefficient);
            candidate.anchorScores.push(contentWeight);
        }
    } catch (err) {
        console.error('[TrialShield] Content cluster analysis failed:', err);
    }

    // 3. Build candidate reports with pairwise scores
    const candidateReports: DuplicateCandidate[] = [];
    const thresholds = CONFIG.duplicateEngine;

    for (const [candidateUserId, data] of candidates.entries()) {
        // Calculate pairwise score using compound probability
        const pairwiseScore = computeCompoundScore(data.anchorScores);

        // Classify
        const classification = classifyDuplicate(pairwiseScore);

        // Fetch account status
        const accountStatus = await fetchAccountStatusForEngine(candidateUserId);

        // For trial_active candidates, run collaborator analysis
        let collaboratorAnalysis: CollaboratorAnalysis | undefined;
        if (accountStatus === 'trial_active' && pairwiseScore >= thresholds.possibleThreshold) {
            collaboratorAnalysis = await analyzeCollabVsDuplicate(userId, candidateUserId);
        }

        candidateReports.push({
            userId: candidateUserId,
            pairwiseScore,
            classification,
            accountStatus,
            sharedDimensions: [...data.sharedDimensions],
            collaboratorAnalysis,
        });
    }

    // Sort by score descending
    candidateReports.sort((a, b) => b.pairwiseScore - a.pairwiseScore);

    // 4. Detect abuse rings
    const abuseRing = await detectAbuseRing(userId, apiKeyId, candidateReports);

    const highestScore = candidateReports.length > 0 ? candidateReports[0].pairwiseScore : 0;

    return {
        userId,
        candidates: candidateReports,
        highestScore,
        classification: classifyDuplicate(highestScore),
        abuseRingDetected: abuseRing.detected,
        abuseRingSize: abuseRing.size,
    };
}

// ─── Compute Pairwise Score ──────────────────────────────────
// Given a user pair, compute full pairwise score across all dimensions
export async function computePairwiseScore(
    userA: string,
    userB: string,
    apiKeyId?: string
): Promise<{ score: number; sharedDimensions: string[] }> {
    const sharedDimensions: string[] = [];
    const weights: number[] = [];

    // 1. Check shared anchors
    try {
        const [{ data: anchorsA }, { data: anchorsB }] = await Promise.all([
            supabaseAdmin.from('ts_identity_anchors').select('anchor_type, anchor_hash').eq('user_id', userA).eq('api_key_id', apiKeyId || ''),
            supabaseAdmin.from('ts_identity_anchors').select('anchor_type, anchor_hash').eq('user_id', userB).eq('api_key_id', apiKeyId || ''),
        ]);

        if (anchorsA && anchorsB) {
            const hashSetB = new Set(anchorsB.map(a => a.anchor_hash));
            const matchedTypes = new Set<string>();

            for (const anchor of anchorsA) {
                if (hashSetB.has(anchor.anchor_hash)) {
                    matchedTypes.add(anchor.anchor_type);
                    const weight = CONFIG.matchScoring.anchorWeights[
                        anchor.anchor_type as keyof typeof CONFIG.matchScoring.anchorWeights
                    ] || 0.3;
                    weights.push(weight);
                }
            }

            for (const type of matchedTypes) {
                sharedDimensions.push(`anchor:${type}`);
            }
        }
    } catch { /* non-fatal */ }

    // 2. Check content overlap
    try {
        const overlap = await getContentOverlap(userA, userB, apiKeyId || '');
        if (overlap.sharedHashes.length > 0) {
            sharedDimensions.push(`content:${overlap.sharedHashes.length}_shared`);
            // Weight based on overlap percentage
            const contentWeight = Math.min(0.85, overlap.overlapPercentage / 100);
            if (contentWeight > 0.1) {
                weights.push(contentWeight);
            }
        }
    } catch { /* non-fatal */ }

    // 3. Check context overlap
    try {
        const [{ data: contextA }, { data: contextB }] = await Promise.all([
            supabaseAdmin.from('ts_identity_anchors').select('anchor_hash').eq('user_id', userA).eq('anchor_type', 'context').eq('api_key_id', apiKeyId || ''),
            supabaseAdmin.from('ts_identity_anchors').select('anchor_hash').eq('user_id', userB).eq('anchor_type', 'context').eq('api_key_id', apiKeyId || ''),
        ]);

        if (contextA && contextB) {
            const contextSetB = new Set(contextB.map(a => a.anchor_hash));
            const sharedContexts = contextA.filter(a => contextSetB.has(a.anchor_hash));

            if (sharedContexts.length > 0) {
                sharedDimensions.push(`context:${sharedContexts.length}_shared`);
                // Each shared context adds incrementally
                const contextWeight = Math.min(0.7, sharedContexts.length * 0.15);
                weights.push(contextWeight);
            }
        }
    } catch { /* non-fatal */ }

    const score = computeCompoundScore(weights);
    return { score, sharedDimensions };
}

// ─── Build User Similarity Graph ─────────────────────────────
// BFS-based graph traversal to find interconnected user clusters
export async function buildUserSimilarityGraph(
    userId: string,
    apiKeyId?: string,
    maxDepth: number = CONFIG.duplicateEngine.maxBFSDepth
): Promise<{ nodes: string[]; edges: { from: string; to: string; score: number }[] }> {
    const visited = new Set<string>();
    const edges: { from: string; to: string; score: number }[] = [];
    const queue: { id: string; depth: number }[] = [{ id: userId, depth: 0 }];

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current.id) || current.depth > maxDepth) continue;
        visited.add(current.id);

        // Find neighbors (users sharing anchors)
        try {
            const { data: userAnchors } = await supabaseAdmin
                .from('ts_identity_anchors')
                .select('anchor_hash')
                .eq('user_id', current.id);

            if (userAnchors) {
                const hashes = userAnchors.map(a => a.anchor_hash);
                const { data: neighbors } = await supabaseAdmin
                    .from('ts_identity_anchors')
                    .select('user_id')
                    .eq('api_key_id', apiKeyId || '') // Enforce multi-tenancy correctly
                    .in('anchor_hash', hashes)
                    .neq('user_id', current.id);

                if (neighbors) {
                    const uniqueNeighbors = [...new Set(neighbors.map(n => n.user_id))];
                    for (const neighborId of uniqueNeighbors) {
                        if (!visited.has(neighborId)) {
                            // Get pairwise score for this edge
                            const { score } = await computePairwiseScore(current.id, neighborId, apiKeyId);
                            if (score > 10) { // Only track meaningful connections
                                edges.push({ from: current.id, to: neighborId, score });
                                queue.push({ id: neighborId, depth: current.depth + 1 });
                            }
                        }
                    }
                }
            }
        } catch { /* non-fatal, continue BFS */ }
    }

    return { nodes: [...visited], edges };
}

// ─── Scan for Abuse Rings ────────────────────────────────────
// Scan for Abuse Rings
export async function scanForAbuseRings(apiKeyId: string): Promise<{
    rings: { userIds: string[]; avgScore: number; strongestLink: number }[];
}> {
    const rings: { userIds: string[]; avgScore: number; strongestLink: number }[] = [];

    try {
        // Find users with the most shared anchors (potential ring centers)
        const { data: anchorCounts } = await supabaseAdmin
            .from('ts_identity_anchors')
            .select('anchor_hash')
            .eq('api_key_id', apiKeyId)
            .limit(500);

        if (!anchorCounts) return { rings };

        // Count how many users share each anchor
        const anchorUserCounts = new Map<string, Set<string>>();
        
        // Get all anchors and their users
        const { data: allAnchors } = await supabaseAdmin
            .from('ts_identity_anchors')
            .select('anchor_hash, user_id')
            .eq('api_key_id', apiKeyId)
            .limit(5000);

        if (!allAnchors) return { rings };

        for (const anchor of allAnchors) {
            if (!anchorUserCounts.has(anchor.anchor_hash)) {
                anchorUserCounts.set(anchor.anchor_hash, new Set());
            }
            anchorUserCounts.get(anchor.anchor_hash)!.add(anchor.user_id);
        }

        // Find anchors shared by many users
        const suspiciousAnchors = [...anchorUserCounts.entries()]
            .filter(([_, users]) => users.size >= CONFIG.duplicateEngine.abuseRingMinSize)
            .sort((a, b) => b[1].size - a[1].size);

        // Build rings from suspicious clusters
        const processedUsers = new Set<string>();
        for (const [_, userIds] of suspiciousAnchors) {
            const ringMembers = [...userIds].filter(id => !processedUsers.has(id));
            if (ringMembers.length < CONFIG.duplicateEngine.abuseRingMinSize) continue;

            // Verify these users have expired trials
            const { data: users } = await supabaseAdmin
                .from('ts_users')
                .select('id, account_status, trial_expires_at')
                .in('id', ringMembers);

            if (!users) continue;

            const expiredMembers = users.filter(u => {
                const status = u.account_status === 'trial_expired' ||
                    (u.trial_expires_at && new Date(u.trial_expires_at) < new Date());
                return status;
            });

            if (expiredMembers.length >= CONFIG.duplicateEngine.abuseRingMinSize) {
                const expiredIds = expiredMembers.map(u => u.id);
                
                // Calculate average pairwise score for the ring
                let totalScore = 0;
                let strongestLink = 0;
                let pairCount = 0;

                for (let i = 0; i < Math.min(expiredIds.length, 5); i++) {
                    for (let j = i + 1; j < Math.min(expiredIds.length, 5); j++) {
                        const { score } = await computePairwiseScore(expiredIds[i], expiredIds[j], apiKeyId);
                        totalScore += score;
                        strongestLink = Math.max(strongestLink, score);
                        pairCount++;
                    }
                }

                rings.push({
                    userIds: expiredIds,
                    avgScore: pairCount > 0 ? Math.round(totalScore / pairCount) : 0,
                    strongestLink,
                });

                expiredIds.forEach(id => processedUsers.add(id));
            }
        }
    } catch (err) {
        console.error('[TrialShield] Abuse ring scan failed:', err);
    }

    return { rings };
}

// ─── Helpers ─────────────────────────────────────────────────

// Compound probability: 1 - Π(1 - weight_i)
function computeCompoundScore(weights: number[]): number {
    if (weights.length === 0) return 0;
    const survivalProbability = weights.reduce((acc, w) => acc * (1 - Math.min(w, 0.99)), 1);
    return Math.min(100, Math.round((1 - survivalProbability) * 100));
}

function classifyDuplicate(score: number): DuplicateClassification {
    const t = CONFIG.duplicateEngine;
    if (score >= t.definiteThreshold) return 'DEFINITE';
    if (score >= t.probableThreshold) return 'PROBABLE';
    if (score >= t.possibleThreshold) return 'POSSIBLE';
    return 'UNLIKELY';
}

async function fetchAccountStatusForEngine(userId: string): Promise<AccountStatus> {
    try {
        const { data } = await supabaseAdmin
            .from('ts_users')
            .select('account_status, trial_expires_at')
            .eq('id', userId)
            .single();

        if (!data) return 'trial_active';

        if (data.account_status === 'paid') return 'paid';
        if (data.account_status === 'trial_expired') return 'trial_expired';

        if (data.trial_expires_at && new Date(data.trial_expires_at) < new Date()) {
            return 'trial_expired';
        }

        return 'trial_active';
    } catch {
        return 'trial_active';
    }
}

// ─── Detect Abuse Ring for a Specific User ───────────────────
async function detectAbuseRing(
    userId: string,
    apiKeyId: string | undefined,
    candidates: DuplicateCandidate[]
): Promise<{ detected: boolean; size: number }> {
    // Filter to strong candidates with expired trials
    const strongCandidates = candidates.filter(
        c => c.pairwiseScore >= CONFIG.duplicateEngine.possibleThreshold &&
            c.accountStatus === 'trial_expired'
    );

    if (strongCandidates.length < CONFIG.duplicateEngine.abuseRingMinSize - 1) {
        return { detected: false, size: 0 };
    }

    // Check interconnections between candidates
    let interconnected = 0;
    const topCandidates = strongCandidates.slice(0, 5);

    for (let i = 0; i < topCandidates.length; i++) {
        for (let j = i + 1; j < topCandidates.length; j++) {
            try {
                const { score } = await computePairwiseScore(topCandidates[i].userId, topCandidates[j].userId, apiKeyId);
                if (score >= CONFIG.duplicateEngine.possibleThreshold) {
                    interconnected++;
                }
            } catch { /* non-fatal */ }
        }
    }

    // If candidates are also connected to each other → abuse ring
    const minEdges = Math.floor(topCandidates.length * 0.5);
    const detected = interconnected >= minEdges;

    return {
        detected,
        size: detected ? strongCandidates.length + 1 : 0, // +1 for the user itself
    };
}
