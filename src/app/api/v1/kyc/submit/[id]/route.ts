// TrialShield — KYC Verification Submit
// POST /api/v1/kyc/submit/[id] — Submit captured images for verification
// This endpoint is PUBLIC (no API key) — accessed by end-users on the verification page
// Security: requires valid, non-expired session ID

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sha256 } from '@/lib/utils';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        // Validate session exists and is not expired
        const { data: session, error: fetchError } = await supabaseAdmin
            .from('ts_kyc_sessions')
            .select('id, status, expires_at, api_key_id')
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

        const body = await request.json();
        const { selfie, documentFront, deviceInfo } = body;

        if (!selfie || !documentFront) {
            return NextResponse.json({ error: 'selfie and documentFront are required' }, { status: 400 });
        }

        // Hash image data for fingerprinting (strip data URI prefix)
        const selfieRaw = selfie.replace(/^data:image\/\w+;base64,/, '');
        const docFrontRaw = documentFront.replace(/^data:image\/\w+;base64,/, '');
        const selfieHash = sha256(selfieRaw);
        const docFrontHash = sha256(docFrontRaw);

        // Check for duplicate selfies across other sessions (same API key)
        const { count: selfieReuse } = await supabaseAdmin
            .from('ts_kyc_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('api_key_id', session.api_key_id)
            .eq('selfie_hash', selfieHash)
            .neq('id', id);

        const { count: docReuse } = await supabaseAdmin
            .from('ts_kyc_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('api_key_id', session.api_key_id)
            .eq('document_front_hash', docFrontHash)
            .neq('id', id);

        // Build result
        const signals: string[] = [];
        let riskScore = 0;

        if ((selfieReuse || 0) > 0) {
            signals.push(`SELFIE_REUSE: Same selfie seen across ${(selfieReuse || 0) + 1} sessions`);
            riskScore += 40;
        }

        if ((docReuse || 0) > 0) {
            signals.push(`DOCUMENT_REUSE: Same document seen across ${(docReuse || 0) + 1} sessions`);
            riskScore += 50;
        }

        const verified = riskScore < 30;

        const result = {
            verified,
            riskScore: Math.min(100, riskScore),
            signals,
            selfieHash,
            documentFrontHash: docFrontHash,
            selfieReuse: selfieReuse || 0,
            documentReuse: docReuse || 0,
            completedAt: new Date().toISOString(),
        };

        // Update session
        const now = new Date().toISOString();
        await supabaseAdmin
            .from('ts_kyc_sessions')
            .update({
                status: 'completed',
                selfie_hash: selfieHash,
                document_front_hash: docFrontHash,
                selfie_data: selfie,
                document_front_data: documentFront,
                device_info: deviceInfo || null,
                result,
                updated_at: now,
                completed_at: now,
            })
            .eq('id', id);

        return NextResponse.json({
            status: 'completed',
            verified,
            riskScore: result.riskScore,
            signals: signals.length,
        });
    } catch (err) {
        console.error('[TrialShield] KYC submit error:', err);
        return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
    }
}
