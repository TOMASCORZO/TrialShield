// TrialShield — API Key Management Endpoint

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateApiKey, hashApiKey } from '@/lib/utils';

// GET - List all API keys
export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('ts_api_keys')
            .select('id, name, rate_limit, is_active, last_used, total_requests, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ keys: data });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
    }
}

// POST - Create new API key
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.name) {
            return NextResponse.json({ error: 'name is required' }, { status: 400 });
        }

        const key = generateApiKey();
        const hashedKey = hashApiKey(key);

        const { data, error } = await supabaseAdmin.from('ts_api_keys').insert({
            name: body.name,
            hashed_key: hashedKey,
            rate_limit: body.rateLimit || 60,
            is_active: true,
        }).select('id, name, created_at').single();

        if (error) throw error;

        return NextResponse.json({
            ...data,
            key, // Only returned on creation — store it securely!
            warning: 'This is the only time the key will be shown. Store it securely.',
        }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
    }
}

// DELETE - Deactivate API key
export async function DELETE(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const keyId = url.searchParams.get('id');

        if (!keyId) {
            return NextResponse.json({ error: 'id query parameter required' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('ts_api_keys')
            .update({ is_active: false })
            .eq('id', keyId);

        if (error) throw error;

        return NextResponse.json({ success: true, message: 'API key deactivated' });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to deactivate API key' }, { status: 500 });
    }
}
