// TrialShield — Activity Tracking Endpoint (v2)
// POST /api/v1/track — Continuous user monitoring during software usage
// Every activity resolves identity, checks content reuse, evaluates match score

import { NextRequest, NextResponse } from 'next/server';
import { TrackRequest, TrackResponse, AnchorType, RiskSignal, DuplicateReport } from '@/types';
import { resolveIdentity, getClientSettings, evaluateEnforcement, revokeUserAccess, notifyWebhook } from '@/services/identity-resolver';
import { processTrackContent } from '@/services/content-fingerprint';
import { identifyDuplicates } from '@/services/duplicate-user-engine';
import { supabaseAdmin } from '@/lib/supabase';
import { hashApiKey, sha256, generateId } from '@/lib/utils';
import { CONFIG } from '@/config';

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        const body: TrackRequest = await request.json();

        // Validate
        if (!body.userId || !body.activityType) {
            return NextResponse.json({
                error: 'userId and activityType are required',
                code: 'MISSING_INPUT',
            }, { status: 400 });
        }

        // Get API key for settings lookup
        const apiKey = request.headers.get('X-API-Key') ||
            request.headers.get('Authorization')?.replace('Bearer ', '') || '';
        const apiKeyId = hashApiKey(apiKey);

        // Get client sensitivity settings
        const settings = await getClientSettings(apiKeyId);

        const signals: RiskSignal[] = [];
        const activityId = generateId();

        // ─── 1. Resolve identity via device + IP anchors ─────
        const anchors: { type: AnchorType; value: string }[] = [];

        if (body.deviceFingerprint?.id) {
            anchors.push({ type: 'device', value: body.deviceFingerprint.id });
        }

        const ip = body.ip ||
            request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            request.headers.get('x-real-ip') || '';

        if (ip) {
            anchors.push({ type: 'ip', value: ip });
        }

        let matchScore = 0;
        let matchedUserId: string | undefined;
        let resolvedUserId = body.userId;

        if (anchors.length > 0) {
            const identity = await resolveIdentity(anchors, apiKeyId);
            matchScore = identity.matchScore;

            if (identity.matchedToUsers.length > 0) {
                matchedUserId = identity.matchedToUsers[0];
                signals.push({
                    module: 'GRAPH',
                    signal: 'IDENTITY_MATCH_DURING_USAGE',
                    severity: matchScore >= settings.matchThreshold ? 'CRITICAL' : 'HIGH',
                    description: `User's device/IP matches ${identity.matchedToUsers.length} other account(s) — match score: ${matchScore}%`,
                    value: matchScore,
                });
            }

            resolvedUserId = identity.resolvedUserId;
        }

        // ─── 2. Process content fingerprints ─────────────────
        const contentResults = await processTrackContent(resolvedUserId, body);
        signals.push(...contentResults.signals);

        // Boost match score based on content reuse
        const contentBoost = contentResults.reuseResults
            .filter(r => r.isReused)
            .reduce((max, r) => Math.max(max, r.matchBoost), 0);

        if (contentBoost > 0) {
            matchScore = Math.min(100, matchScore + contentBoost);

            const reuseMatch = contentResults.reuseResults.find(r => r.isReused && r.originalUserId);
            if (reuseMatch?.originalUserId && !matchedUserId) {
                matchedUserId = reuseMatch.originalUserId;
            }
        }

        // ─── 3. Duplicate User Engine (optional) ────────────
        let duplicateReport: DuplicateReport | undefined;
        if (CONFIG.features.enableContentFingerprinting) {
            try {
                const report = await identifyDuplicates(resolvedUserId);
                if (report.candidates.length > 0 && report.highestScore > 0) {
                    duplicateReport = report;

                    // Boost match score based on duplicate detection
                    if (report.highestScore > matchScore) {
                        matchScore = Math.min(100, Math.max(matchScore, report.highestScore));
                    }

                    if (report.abuseRingDetected) {
                        signals.push({
                            module: 'GRAPH',
                            signal: 'ABUSE_RING_DETECTED',
                            severity: 'CRITICAL',
                            description: `User is part of an abuse ring with ${report.abuseRingSize} connected accounts`,
                            value: report.abuseRingSize,
                        });
                    }

                    // Add signal for top duplicate candidate
                    const topCandidate = report.candidates[0];
                    if (topCandidate.classification !== 'UNLIKELY') {
                        signals.push({
                            module: 'GRAPH',
                            signal: `DUPLICATE_${topCandidate.classification}`,
                            severity: topCandidate.classification === 'DEFINITE' ? 'CRITICAL' :
                                topCandidate.classification === 'PROBABLE' ? 'HIGH' : 'MEDIUM',
                            description: `${topCandidate.classification} duplicate: ${topCandidate.pairwiseScore}% match with user ${topCandidate.userId} (${topCandidate.accountStatus})${topCandidate.collaboratorAnalysis ? ` — collab analysis: ${topCandidate.collaboratorAnalysis.isDuplicate ? 'DUPLICATE' : 'COLLABORATOR'}` : ''}`,
                            value: topCandidate.pairwiseScore,
                        });

                        if (!matchedUserId) {
                            matchedUserId = topCandidate.userId;
                        }
                    }
                }
            } catch (err) {
                console.error('[TrialShield] Duplicate engine error:', err);
            }
        }

        // ─── 3. Evaluate enforcement ─────────────────────────
        const enforcement = evaluateEnforcement(matchScore, settings, matchedUserId);

        // Auto-revoke if threshold exceeded
        if (enforcement.action === 'REVOKE') {
            await revokeUserAccess(resolvedUserId, enforcement.reason, matchedUserId);

            // Notify client webhook if configured
            if (settings.notifyWebhook) {
                await notifyWebhook(settings.notifyWebhook, enforcement, resolvedUserId);
            }
        }

        // ─── 4. Log activity ─────────────────────────────────
        try {
            await supabaseAdmin.from('ts_activity_log').insert({
                user_id: resolvedUserId,
                api_key_id: apiKeyId,
                activity_type: body.activityType,
                activity_hash: body.metadata ? sha256(JSON.stringify(body.metadata)) : null,
                match_score_at_time: matchScore,
                enforcement_action: enforcement.action,
                metadata: body.metadata || {},
                ip_address: ip ? sha256(ip) : null,
                device_fingerprint_id: body.deviceFingerprint?.id,
            });
        } catch (err) {
            console.error('[TrialShield] Failed to log activity:', err);
        }

        // ─── 5. Build response ───────────────────────────────
        const status = enforcement.action === 'REVOKE' ? 'REVOKE' :
            enforcement.action === 'WARN' ? 'WARN' : 'OK';

        const response: TrackResponse = {
            matchScore,
            status,
            matchedUserId: enforcement.action !== 'NONE' ? matchedUserId : undefined,
            signals,
            contentReuse: contentResults.reuseResults.filter(r => r.isReused),
            enforcement: enforcement.action !== 'NONE' ? enforcement : undefined,
            duplicateReport,
            activityId,
        };

        return NextResponse.json(response, {
            status: 200,
            headers: {
                'X-Match-Score': matchScore.toString(),
                'X-Status': status,
                'X-Processing-Time': `${Date.now() - startTime}ms`,
            },
        });
    } catch (error) {
        console.error('[TrialShield] Track endpoint error:', error);
        return NextResponse.json({
            error: 'Internal error during activity tracking',
            code: 'INTERNAL_ERROR',
        }, { status: 500 });
    }
}

// CORS
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
        },
    });
}
