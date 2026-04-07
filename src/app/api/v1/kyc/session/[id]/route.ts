// TrialShield — KYC Session Status
// GET /api/v1/kyc/session/[id] — Get session status + verification level

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    if (!id) {
        return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    try {
        const { data: session, error } = await supabaseAdmin
            .from('ts_kyc_sessions')
            .select('id, external_user_id, status, verification_level, result, device_info, created_at, updated_at, completed_at, expires_at, redirect_url')
            .eq('id', id)
            .single();

        if (error || !session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        if (session.status === 'pending' && new Date(session.expires_at) < new Date()) {
            await supabaseAdmin
                .from('ts_kyc_sessions')
                .update({ status: 'expired', updated_at: new Date().toISOString() })
                .eq('id', id);

            return NextResponse.json({
                sessionId: session.id,
                status: 'expired',
                message: 'This verification session has expired.',
            });
        }

        return NextResponse.json({
            sessionId: session.id,
            status: session.status,
            level: session.verification_level || 'document_face',
            result: session.result,
            redirectUrl: session.redirect_url,
            createdAt: session.created_at,
            completedAt: session.completed_at,
            expiresAt: session.expires_at,
        });
    } catch (err) {
        console.error('[TrialShield] KYC status error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
