// TrialShield — KYC Session Management
// POST /api/v1/kyc/session — Create a new KYC verification session
// GET  /api/v1/kyc/session — List sessions for the authenticated API key
//
// Verification levels:
//   document_only  — OCR + MRZ extraction, document hash
//   document_face  — Above + selfie capture + face matching (selfie vs ID photo)
//   full           — Above + liveness detection (blink challenge)

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateRequest, buildAuthError } from '@/lib/auth-middleware';

const VALID_LEVELS = ['document_only', 'document_face', 'full'];

export async function POST(request: NextRequest) {
    const auth = await authenticateRequest(request, 'verify');
    if (!auth.authorized) return buildAuthError(auth);

    try {
        const body = await request.json();
        const { userId, redirectUrl, metadata, level } = body;

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const verificationLevel = VALID_LEVELS.includes(level) ? level : 'document_face';
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        const { data: session, error } = await supabaseAdmin
            .from('ts_kyc_sessions')
            .insert({
                api_key_id: auth.apiKeyUUID,
                external_user_id: userId,
                status: 'pending',
                verification_level: verificationLevel,
                redirect_url: redirectUrl || null,
                metadata: metadata || null,
                expires_at: expiresAt,
            })
            .select('id, status, verification_level, created_at, expires_at')
            .single();

        if (error) {
            console.error('[TrialShield] KYC session create error:', error);
            return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
        }

        const host = request.headers.get('host') || 'trialshield.cc';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const verifyUrl = `${protocol}://${host}/verify/${session.id}`;

        return NextResponse.json({
            sessionId: session.id,
            status: session.status,
            level: session.verification_level,
            verifyUrl,
            expiresAt: session.expires_at,
            createdAt: session.created_at,
        });
    } catch (err) {
        console.error('[TrialShield] KYC session error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    const auth = await authenticateRequest(request, 'verify');
    if (!auth.authorized) return buildAuthError(auth);

    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

        let query = supabaseAdmin
            .from('ts_kyc_sessions')
            .select('id, external_user_id, status, verification_level, result, created_at, completed_at, expires_at')
            .eq('api_key_id', auth.apiKeyUUID)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (status) query = query.eq('status', status);

        const { data: sessions, error } = await query;

        if (error) {
            return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
        }

        return NextResponse.json({ sessions: sessions || [] });
    } catch (err) {
        console.error('[TrialShield] KYC list error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
