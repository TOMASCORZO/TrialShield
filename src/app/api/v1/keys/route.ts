// TrialShield — API Key Management Endpoint
// All operations require a Supabase auth JWT (Bearer <access_token>).
// Ownership is enforced server-side: a user can only see/create/delete their own keys.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateApiKey, hashApiKey } from '@/lib/utils';

async function requireUserId(request: NextRequest): Promise<{ userId: string } | NextResponse> {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }
    return { userId: user.id };
}

// GET - List API keys owned by the authenticated user
export async function GET(request: NextRequest) {
    const auth = await requireUserId(request);
    if (auth instanceof NextResponse) return auth;

    try {
        const { data, error } = await supabaseAdmin
            .from('ts_api_keys')
            .select('id, name, rate_limit, is_active, last_used, total_requests, created_at, plan, subscription_status, creem_customer_id, trial_ends_at')
            .eq('owner_id', auth.userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ keys: data });
    } catch (error) {
        console.error('[TrialShield] keys GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
    }
}

// POST - Create a new API key for the authenticated user
export async function POST(request: NextRequest) {
    const auth = await requireUserId(request);
    if (auth instanceof NextResponse) return auth;

    try {
        const body = await request.json();
        if (!body.name || typeof body.name !== 'string') {
            return NextResponse.json({ error: 'name is required' }, { status: 400 });
        }

        const key = generateApiKey();
        const hashedKey = hashApiKey(key);

        const { data, error } = await supabaseAdmin.from('ts_api_keys').insert({
            name: body.name,
            hashed_key: hashedKey,
            owner_id: auth.userId,
            rate_limit: body.rateLimit || 60,
            is_active: true,
            plan: 'pending',
            subscription_status: 'pending',
        }).select('id, name, created_at').single();

        if (error) throw error;

        return NextResponse.json({
            ...data,
            key, // Only returned on creation — store it securely!
            warning: 'This is the only time the key will be shown. Store it securely.',
        }, { status: 201 });
    } catch (error) {
        console.error('[TrialShield] keys POST error:', error);
        return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
    }
}

// DELETE - Deactivate one of the authenticated user's API keys
export async function DELETE(request: NextRequest) {
    const auth = await requireUserId(request);
    if (auth instanceof NextResponse) return auth;

    try {
        const url = new URL(request.url);
        const keyId = url.searchParams.get('id');

        if (!keyId) {
            return NextResponse.json({ error: 'id query parameter required' }, { status: 400 });
        }

        const { data: updated, error } = await supabaseAdmin
            .from('ts_api_keys')
            .update({ is_active: false })
            .eq('id', keyId)
            .eq('owner_id', auth.userId)
            .select('id')
            .single();

        if (error || !updated) {
            return NextResponse.json({ error: 'API key not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'API key deactivated' });
    } catch (error) {
        console.error('[TrialShield] keys DELETE error:', error);
        return NextResponse.json({ error: 'Failed to deactivate API key' }, { status: 500 });
    }
}
