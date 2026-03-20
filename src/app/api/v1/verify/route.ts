// TrialShield — Main Verify Endpoint (v2 — with Identity Resolution)
// POST /api/v1/verify — Evaluates user risk, resolves identity, returns ALLOW/DENY/CHALLENGE

import { NextRequest, NextResponse } from 'next/server';
import { evaluateRisk } from '@/services/risk-scoring';
import { logAuditEvent } from '@/services/compliance';
import { resolveIdentity, getClientSettings, evaluateEnforcement, revokeUserAccess, notifyWebhook } from '@/services/identity-resolver';
import { VerifyRequest, AnchorType } from '@/types';
import { hashApiKey, sha256 } from '@/lib/utils';
import { authenticateRequest, buildAuthError } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        // ─── Auth check: API key + subscription ──────────────────
        const auth = await authenticateRequest(request, 'verify');
        if (!auth.authorized) return buildAuthError(auth);

        const body: VerifyRequest = await request.json();

        // Validate request
        if (!body.email && !body.phone && !body.ip) {
            return NextResponse.json({
                error: 'At least one of email, phone, or ip is required',
                code: 'MISSING_INPUT',
            }, { status: 400 });
        }

        // Get client IP if not provided
        if (!body.ip) {
            body.ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                request.headers.get('x-real-ip') ||
                '0.0.0.0';
        }

        // Use the authenticated API key ID
        const apiKeyId = auth.apiKeyId;

        // ─── v2: Build identity anchors from all provided signals ───
        const anchors: { type: AnchorType; value: string }[] = [];

        if (body.email) {
            anchors.push({ type: 'email', value: body.email.toLowerCase().trim() });
        }
        if (body.phone) {
            anchors.push({ type: 'phone', value: body.phone.replace(/[^0-9+]/g, '') });
        }
        if (body.ip && body.ip !== '0.0.0.0') {
            anchors.push({ type: 'ip', value: body.ip });
        }
        if (body.deviceFingerprint?.id) {
            anchors.push({ type: 'device', value: body.deviceFingerprint.id });
        }
        
        // Advanced Payment Anchors (Stripe variables)
        const payment = body.metadata?.payment as Record<string, string> | undefined;
        if (payment) {
            if (payment.fingerprint) anchors.push({ type: 'card_fingerprint', value: payment.fingerprint });
            if (payment.bin) anchors.push({ type: 'card_bin', value: payment.bin.replace(/[^0-9]/g, '') });
            if (payment.last4 && payment.billingZip) anchors.push({ type: 'card_last4_zip', value: `${payment.last4.replace(/[^0-9]/g, '')}_${payment.billingZip.trim()}` });
            if (payment.bin && payment.last4) anchors.push({ type: 'card_bin_last4', value: `${payment.bin.replace(/[^0-9]/g, '')}_${payment.last4.replace(/[^0-9]/g, '')}` });
            if (payment.name) anchors.push({ type: 'card_name', value: payment.name.toLowerCase().trim() });
            if (payment.billingZip) anchors.push({ type: 'billing_zip', value: payment.billingZip.trim() });
            if (payment.country) anchors.push({ type: 'card_country', value: payment.country.toUpperCase().trim() });
        } else if (body.metadata?.paymentBin) {
            // Legacy support
            anchors.push({ type: 'card_bin', value: String(body.metadata.paymentBin).replace(/[^0-9]/g, '').substring(0, 8) });
        }

        // ─── v2: Resolve identity ────────────────────────────────
        const extendedMetadata = { ...body.metadata };
        if (body.organizationId) extendedMetadata.organizationId = body.organizationId;
        const identity = await resolveIdentity(anchors, apiKeyId, extendedMetadata);

        // ─── v2: Check client settings for threshold ─────────────
        const settings = await getClientSettings(apiKeyId);

        // ─── v2: If device/email/phone already belongs to another user, 
        //         immediately evaluate match ──────────────────────────
        if (identity.matchedToUsers.length > 0) {
            const enforcement = evaluateEnforcement(
                identity.matchScore,
                settings,
                identity.matchedToUsers[0]
            );

            // If match exceeds threshold → DENY immediately
            if (enforcement.action === 'REVOKE') {
                await revokeUserAccess(identity.resolvedUserId, enforcement.reason, identity.matchedToUsers[0]);

                if (settings.notifyWebhook) {
                    await notifyWebhook(settings.notifyWebhook, enforcement, identity.resolvedUserId);
                }

                const processingTimeMs = Date.now() - startTime;

                // Audit log
                await logAuditEvent(
                    apiKeyId, '/api/v1/verify', 'POST',
                    body as unknown as Record<string, unknown>,
                    'DENY', 100, body.ip || '0.0.0.0', processingTimeMs
                );

                return NextResponse.json({
                    id: identity.resolvedUserId,
                    decision: 'DENY',
                    riskScore: 100,
                    matchScore: identity.matchScore,
                    matchedUserId: identity.matchedToUsers[0],
                    signals: identity.matchedAnchors.map(a => ({
                        module: 'GRAPH' as const,
                        signal: `IDENTITY_MATCH_${a.anchorType.toUpperCase()}`,
                        severity: 'CRITICAL' as const,
                        description: `${a.anchorType} signal matches existing user (seen ${a.timesSeen} times)`,
                        value: a.confidence,
                    })),
                    enforcement,
                    breakdown: {
                        emailScore: 0, phoneScore: 0, ipScore: 0,
                        deviceScore: 0, behaviorScore: 0, graphScore: 100,
                        finalScore: 100,
                        weights: {},
                    },
                    enrichment: { totalSignals: identity.matchedAnchors.length },
                    processingTimeMs,
                    timestamp: new Date().toISOString(),
                }, {
                    status: 200,
                    headers: {
                        'X-Risk-Score': '100',
                        'X-Match-Score': identity.matchScore.toString(),
                        'X-Decision': 'DENY',
                        'X-Processing-Time': `${processingTimeMs}ms`,
                    },
                });
            }
        }

        // ─── Run full evaluation (existing risk engine) ──────────
        const result = await evaluateRisk(body, apiKeyId, identity.resolvedUserId);

        // ─── v2: Merge match score into response ─────────────────
        const enhancedResult = {
            ...result,
            matchScore: identity.matchScore,
            matchedUserId: identity.matchedToUsers.length > 0 ? identity.matchedToUsers[0] : undefined,
            isNewUser: identity.isNewUser,
            resolvedUserId: identity.resolvedUserId,
        };

        // Audit log
        const processingTimeMs = Date.now() - startTime;
        await logAuditEvent(
            apiKeyId, '/api/v1/verify', 'POST',
            body as unknown as Record<string, unknown>,
            result.decision, result.riskScore,
            body.ip || '0.0.0.0', processingTimeMs
        );

        return NextResponse.json(enhancedResult, {
            status: 200,
            headers: {
                'X-Risk-Score': result.riskScore.toString(),
                'X-Match-Score': identity.matchScore.toString(),
                'X-Decision': result.decision,
                'X-Processing-Time': `${processingTimeMs}ms`,
            },
        });
    } catch (error) {
        console.error('[TrialShield] Verify endpoint error:', error);
        return NextResponse.json({
            error: 'Internal server error during risk evaluation',
            code: 'INTERNAL_ERROR',
        }, { status: 500 });
    }
}

// Handle OPTIONS for CORS
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

