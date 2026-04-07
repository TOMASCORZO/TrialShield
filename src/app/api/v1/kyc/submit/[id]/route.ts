// TrialShield — KYC Verification Submit
// POST /api/v1/kyc/submit/[id] — Submit verification data from client-side processing
// PUBLIC endpoint — accessed by end-users on the verification page
//
// Receives client-side analysis results:
//   - OCR extracted text + parsed document data
//   - MRZ parsed data (if passport/ID)
//   - Face match score (selfie vs document photo)
//   - Liveness detection result
//   - Image hashes (selfie + document)
//   - Device info

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sha256 } from '@/lib/utils';

interface SubmitPayload {
    // Document data
    documentHash: string;
    ocrText?: string;
    documentData?: {
        fullName?: string;
        firstName?: string;
        lastName?: string;
        dateOfBirth?: string;
        documentNumber?: string;
        expiryDate?: string;
        nationality?: string;
        gender?: string;
        documentType?: string;
        issuingCountry?: string;
    };
    mrzData?: {
        valid: boolean;
        format?: string;
        documentNumber?: string;
        firstName?: string;
        lastName?: string;
        dateOfBirth?: string;
        expiryDate?: string;
        nationality?: string;
        sex?: string;
    };
    // Face matching
    selfieHash?: string;
    faceMatchScore?: number;       // 0-1, Euclidean distance (lower = better match)
    faceDetectedOnDocument?: boolean;
    faceDetectedOnSelfie?: boolean;
    // Liveness
    livenessResult?: {
        passed: boolean;
        blinkDetected?: boolean;
        challengeCompleted?: boolean;
        attempts?: number;
    };
    // Images (base64)
    selfie?: string;
    documentFront?: string;
    // Device
    deviceInfo?: Record<string, unknown>;
}

export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const { data: session, error: fetchError } = await supabaseAdmin
            .from('ts_kyc_sessions')
            .select('id, status, expires_at, api_key_id, verification_level')
            .eq('id', id)
            .single();

        if (fetchError || !session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        if (session.status === 'completed') {
            return NextResponse.json({ error: 'Session already completed' }, { status: 400 });
        }

        if (session.status === 'expired' || new Date(session.expires_at) < new Date()) {
            await supabaseAdmin
                .from('ts_kyc_sessions')
                .update({ status: 'expired', updated_at: new Date().toISOString() })
                .eq('id', id);
            return NextResponse.json({ error: 'Session expired' }, { status: 410 });
        }

        const body: SubmitPayload = await _request.json();
        const level = session.verification_level || 'document_face';

        // ─── Build risk signals ─────────────────────────────────
        const signals: Array<{ signal: string; severity: string; description: string }> = [];
        let riskScore = 0;

        // Hash images for deduplication
        const docHash = body.documentHash || (body.documentFront
            ? sha256(body.documentFront.replace(/^data:image\/\w+;base64,/, ''))
            : null);
        const selfHash = body.selfieHash || (body.selfie
            ? sha256(body.selfie.replace(/^data:image\/\w+;base64,/, ''))
            : null);

        // ─── 1. Document analysis ───────────────────────────────
        const hasOcrData = body.documentData && (body.documentData.fullName || body.documentData.firstName);
        const hasMrz = body.mrzData?.valid;

        if (!hasOcrData && !hasMrz) {
            riskScore += 20;
            signals.push({
                signal: 'NO_DOCUMENT_DATA',
                severity: 'HIGH',
                description: 'No readable text or MRZ could be extracted from the document',
            });
        }

        // MRZ validation
        if (body.mrzData && !body.mrzData.valid) {
            riskScore += 15;
            signals.push({
                signal: 'INVALID_MRZ',
                severity: 'HIGH',
                description: 'MRZ data present but failed validation checks',
            });
        }

        if (hasMrz) {
            // Check document expiry
            if (body.mrzData?.expiryDate) {
                const expiry = parseDocDate(body.mrzData.expiryDate);
                if (expiry && expiry < new Date()) {
                    riskScore += 25;
                    signals.push({
                        signal: 'DOCUMENT_EXPIRED',
                        severity: 'CRITICAL',
                        description: `Document expired on ${body.mrzData.expiryDate}`,
                    });
                }
            }

            // Check DOB plausibility
            if (body.mrzData?.dateOfBirth) {
                const dob = parseDocDate(body.mrzData.dateOfBirth);
                if (dob) {
                    const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
                    if (age < 13 || age > 120) {
                        riskScore += 20;
                        signals.push({
                            signal: 'IMPLAUSIBLE_AGE',
                            severity: 'HIGH',
                            description: `Calculated age ${Math.floor(age)} is implausible`,
                        });
                    }
                }
            }
        }

        // ─── 2. Document reuse detection ────────────────────────
        if (docHash) {
            const { count: docReuse } = await supabaseAdmin
                .from('ts_kyc_sessions')
                .select('*', { count: 'exact', head: true })
                .eq('api_key_id', session.api_key_id)
                .eq('document_front_hash', docHash)
                .neq('id', id);

            if ((docReuse || 0) > 0) {
                riskScore += 40;
                signals.push({
                    signal: 'DOCUMENT_REUSE',
                    severity: 'CRITICAL',
                    description: `Same document seen across ${(docReuse || 0) + 1} verification sessions`,
                });
            }
        }

        // ─── 3. Face matching analysis ──────────────────────────
        if (level !== 'document_only') {
            if (!body.faceDetectedOnDocument) {
                riskScore += 15;
                signals.push({
                    signal: 'NO_FACE_ON_DOCUMENT',
                    severity: 'HIGH',
                    description: 'No face could be detected on the ID document photo',
                });
            }

            if (!body.faceDetectedOnSelfie) {
                riskScore += 15;
                signals.push({
                    signal: 'NO_FACE_ON_SELFIE',
                    severity: 'HIGH',
                    description: 'No face could be detected in the selfie',
                });
            }

            if (body.faceMatchScore !== undefined) {
                // face-api.js Euclidean distance: <0.4 = strong match, 0.4-0.6 = possible, >0.6 = no match
                if (body.faceMatchScore > 0.6) {
                    riskScore += 40;
                    signals.push({
                        signal: 'FACE_MISMATCH',
                        severity: 'CRITICAL',
                        description: `Face match score ${body.faceMatchScore.toFixed(2)} — selfie does not match document photo`,
                    });
                } else if (body.faceMatchScore > 0.45) {
                    riskScore += 15;
                    signals.push({
                        signal: 'FACE_WEAK_MATCH',
                        severity: 'MEDIUM',
                        description: `Face match score ${body.faceMatchScore.toFixed(2)} — weak similarity between selfie and document`,
                    });
                }
                // <0.45 = good match, no penalty
            } else if (body.faceDetectedOnDocument && body.faceDetectedOnSelfie) {
                riskScore += 10;
                signals.push({
                    signal: 'FACE_COMPARISON_FAILED',
                    severity: 'MEDIUM',
                    description: 'Faces detected but comparison could not be completed',
                });
            }

            // Selfie reuse
            if (selfHash) {
                const { count: selfieReuse } = await supabaseAdmin
                    .from('ts_kyc_sessions')
                    .select('*', { count: 'exact', head: true })
                    .eq('api_key_id', session.api_key_id)
                    .eq('selfie_hash', selfHash)
                    .neq('id', id);

                if ((selfieReuse || 0) > 0) {
                    riskScore += 35;
                    signals.push({
                        signal: 'SELFIE_REUSE',
                        severity: 'CRITICAL',
                        description: `Same selfie seen across ${(selfieReuse || 0) + 1} sessions`,
                    });
                }
            }
        }

        // ─── 4. Liveness detection ──────────────────────────────
        if (level === 'full') {
            if (!body.livenessResult?.passed) {
                riskScore += 30;
                signals.push({
                    signal: 'LIVENESS_FAILED',
                    severity: 'CRITICAL',
                    description: body.livenessResult?.blinkDetected === false
                        ? 'No blink detected — possible photo or screen replay attack'
                        : 'Liveness challenge not completed',
                });
            }
        }

        // ─── 5. Determine verdict ───────────────────────────────
        riskScore = Math.min(100, riskScore);
        const verified = riskScore < 30;
        const decision = riskScore < 20 ? 'VERIFIED' : riskScore < 50 ? 'REVIEW' : 'REJECTED';

        const result = {
            verified,
            decision,
            riskScore,
            signals,
            level,
            document: {
                ocrExtracted: !!hasOcrData,
                mrzValid: !!hasMrz,
                data: body.documentData || null,
                mrzData: body.mrzData || null,
                hash: docHash,
            },
            face: level !== 'document_only' ? {
                matchScore: body.faceMatchScore ?? null,
                faceOnDocument: body.faceDetectedOnDocument ?? false,
                faceOnSelfie: body.faceDetectedOnSelfie ?? false,
                selfieHash: selfHash,
            } : null,
            liveness: level === 'full' ? {
                passed: body.livenessResult?.passed ?? false,
                blinkDetected: body.livenessResult?.blinkDetected ?? false,
            } : null,
            completedAt: new Date().toISOString(),
        };

        // ─── 6. Store results ───────────────────────────────────
        const now = new Date().toISOString();
        await supabaseAdmin
            .from('ts_kyc_sessions')
            .update({
                status: 'completed',
                selfie_hash: selfHash,
                document_front_hash: docHash,
                selfie_data: body.selfie || null,
                document_front_data: body.documentFront || null,
                device_info: body.deviceInfo || null,
                result,
                updated_at: now,
                completed_at: now,
            })
            .eq('id', id);

        return NextResponse.json({
            status: 'completed',
            verified,
            decision,
            riskScore,
            signalCount: signals.length,
            level,
        });
    } catch (err) {
        console.error('[TrialShield] KYC submit error:', err);
        return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
    }
}

// Parse dates in YYMMDD or DD/MM/YYYY format
function parseDocDate(dateStr: string): Date | null {
    try {
        // YYMMDD format (MRZ)
        if (/^\d{6}$/.test(dateStr)) {
            const yy = parseInt(dateStr.slice(0, 2));
            const mm = parseInt(dateStr.slice(2, 4)) - 1;
            const dd = parseInt(dateStr.slice(4, 6));
            const year = yy > 50 ? 1900 + yy : 2000 + yy;
            return new Date(year, mm, dd);
        }
        return new Date(dateStr);
    } catch {
        return null;
    }
}
