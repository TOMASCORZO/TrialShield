// TrialShield — OAuth Configuration Endpoint
// POST /api/v1/oauth/config — Store client's OAuth credentials (Google/GitHub)
// GET  /api/v1/oauth/config — Retrieve current OAuth config for this API key

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashApiKey, sha256 } from '@/lib/utils';

export async function POST(request: NextRequest) {
    try {
        const apiKey = request.headers.get('X-API-Key') ||
            request.headers.get('Authorization')?.replace('Bearer ', '') || '';
        if (!apiKey) {
            return NextResponse.json({ error: 'API key required' }, { status: 401 });
        }
        const apiKeyId = hashApiKey(apiKey);

        const body = await request.json();

        // Validate required fields
        if (!body.provider || !['google', 'github'].includes(body.provider)) {
            return NextResponse.json({
                error: 'provider must be "google" or "github"',
                code: 'INVALID_PROVIDER',
            }, { status: 400 });
        }

        if (!body.clientId || !body.clientSecret) {
            return NextResponse.json({
                error: 'clientId and clientSecret are required',
                code: 'MISSING_CREDENTIALS',
            }, { status: 400 });
        }

        if (!body.redirectUri) {
            return NextResponse.json({
                error: 'redirectUri is required (where to send users after OAuth completes)',
                code: 'MISSING_REDIRECT',
            }, { status: 400 });
        }

        // Upsert OAuth config for this API key + provider
        const { error } = await supabaseAdmin.from('ts_oauth_configs').upsert({
            api_key_id: apiKeyId,
            provider: body.provider,
            client_id: body.clientId,
            client_secret_encrypted: sha256(body.clientSecret), // We store hash for lookup
            client_secret_raw: body.clientSecret, // Stored encrypted at rest in Supabase
            redirect_uri: body.redirectUri,
            scopes: body.scopes || getDefaultScopes(body.provider),
            is_active: true,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'api_key_id,provider' });

        if (error) {
            console.error('[TrialShield] OAuth config save failed:', error);
            return NextResponse.json({ error: 'Failed to save OAuth config' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            provider: body.provider,
            redirectUri: body.redirectUri,
            scopes: body.scopes || getDefaultScopes(body.provider),
            authorizeUrl: `${getBaseUrl(request)}/api/v1/oauth/authorize?provider=${body.provider}&api_key=${apiKey}`,
            message: `OAuth ${body.provider} configured. Redirect users to the authorizeUrl to start the flow.`,
        });
    } catch (error) {
        console.error('[TrialShield] OAuth config error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const apiKey = request.headers.get('X-API-Key') ||
            request.headers.get('Authorization')?.replace('Bearer ', '') || '';
        if (!apiKey) {
            return NextResponse.json({ error: 'API key required' }, { status: 401 });
        }
        const apiKeyId = hashApiKey(apiKey);

        const { data } = await supabaseAdmin
            .from('ts_oauth_configs')
            .select('provider, client_id, redirect_uri, scopes, is_active, updated_at')
            .eq('api_key_id', apiKeyId);

        return NextResponse.json({
            configs: data || [],
        });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

function getDefaultScopes(provider: string): string[] {
    switch (provider) {
        case 'github':
            return ['read:user', 'user:email'];
        case 'google':
            return [
                'openid',
                'email',
                'profile',
                'https://www.googleapis.com/auth/drive.metadata.readonly',
            ];
        default:
            return [];
    }
}

function getBaseUrl(request: NextRequest): string {
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    return `${protocol}://${host}`;
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
        },
    });
}
