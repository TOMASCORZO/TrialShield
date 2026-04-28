// TrialShield — User Management & GDPR Delete Endpoint
// Tenant isolation: a caller can only export/delete end-users that have at least
// one risk event tied to one of their own API keys. This prevents cross-tenant
// reads and deletions even when the master key is rotated or scoped to a single client.

import { NextRequest, NextResponse } from 'next/server';
import { handleDeleteRequest, exportUserData } from '@/services/compliance';
import { supabaseAdmin } from '@/lib/supabase';
import { hashApiKey, sha256 } from '@/lib/utils';

async function authorizeIdentifier(
    request: NextRequest,
    identifier: string,
    type: 'email' | 'phone' | 'user_id',
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
    const apiKey = request.headers.get('X-API-Key') ||
        request.headers.get('Authorization')?.replace('Bearer ', '') || '';

    if (!apiKey) {
        return { ok: false, status: 401, error: 'API key required' };
    }

    // Master key bypasses ownership (used by support tooling).
    const masterKey = process.env.TRIALSHIELD_MASTER_KEY;
    if (masterKey && apiKey === masterKey) return { ok: true };

    const hashedKey = hashApiKey(apiKey);
    const { data: keyRecord } = await supabaseAdmin
        .from('ts_api_keys')
        .select('id, owner_id, is_active')
        .eq('hashed_key', hashedKey)
        .single();

    if (!keyRecord || !keyRecord.is_active) {
        return { ok: false, status: 401, error: 'Invalid or inactive API key' };
    }

    // Resolve identifier → ts_users.id
    let userId: string | null = null;
    if (type === 'user_id') {
        userId = identifier;
    } else {
        const field = type === 'email' ? 'email_hash' : 'phone_hash';
        const { data } = await supabaseAdmin
            .from('ts_users')
            .select('id')
            .eq(field, sha256(identifier))
            .single();
        userId = data?.id || null;
    }

    if (!userId) {
        // No record exists — let the caller proceed; the service will return a no-op.
        return { ok: true };
    }

    // Gather all api_key ids owned by this caller (including the one they used).
    const { data: ownerKeys } = await supabaseAdmin
        .from('ts_api_keys')
        .select('id')
        .eq('owner_id', keyRecord.owner_id);

    const keyIds = (ownerKeys || []).map(k => k.id);
    if (keyIds.length === 0) {
        return { ok: false, status: 403, error: 'User does not belong to this tenant' };
    }

    const { count } = await supabaseAdmin
        .from('ts_risk_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('api_key_id', keyIds);

    if (!count || count === 0) {
        return { ok: false, status: 403, error: 'User does not belong to this tenant' };
    }

    return { ok: true };
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const url = new URL(request.url);
        const type = (url.searchParams.get('type') || 'email') as 'email' | 'phone';

        const auth = await authorizeIdentifier(request, id, type);
        if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

        const data = await exportUserData(id, type);
        return NextResponse.json(data);
    } catch (error) {
        console.error('[TrialShield] users GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
    }
}

// DELETE - GDPR/CCPA Data Deletion
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const url = new URL(request.url);
        const type = (url.searchParams.get('type') || 'user_id') as 'email' | 'phone' | 'user_id';

        const auth = await authorizeIdentifier(request, id, type);
        if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

        const result = await handleDeleteRequest(id, type);

        if (result.success) {
            return NextResponse.json(result);
        }
        return NextResponse.json(result, { status: 500 });
    } catch (error) {
        console.error('[TrialShield] users DELETE error:', error);
        return NextResponse.json({ error: 'Delete request failed' }, { status: 500 });
    }
}
