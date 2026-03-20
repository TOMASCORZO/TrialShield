// TrialShield — OAuth Authorize Endpoint
// GET /api/v1/oauth/authorize?provider=github&api_key=xxx&state=optional
// Redirects the user to the OAuth provider's consent screen
// After consent, provider redirects to /api/v1/oauth/callback

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashApiKey, sha256, generateId } from '@/lib/utils';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const provider = searchParams.get('provider');
        const apiKey = searchParams.get('api_key') || '';
        const clientState = searchParams.get('state') || ''; // Optional client-side state

        if (!provider || !['google', 'github'].includes(provider)) {
            return NextResponse.json({ error: 'provider must be "google" or "github"' }, { status: 400 });
        }

        if (!apiKey) {
            return NextResponse.json({ error: 'api_key query parameter required' }, { status: 401 });
        }

        const apiKeyId = hashApiKey(apiKey);

        // Fetch OAuth config for this API key + provider
        const { data: config } = await supabaseAdmin
            .from('ts_oauth_configs')
            .select('client_id, redirect_uri, scopes')
            .eq('api_key_id', apiKeyId)
            .eq('provider', provider)
            .eq('is_active', true)
            .single();

        if (!config) {
            return NextResponse.json({
                error: `No OAuth config found for provider "${provider}". Configure it first via POST /api/v1/oauth/config`,
                code: 'NO_OAUTH_CONFIG',
            }, { status: 404 });
        }

        // Generate a unique session state to prevent CSRF
        const sessionId = generateId();

        // Store the session state for validation in callback
        await supabaseAdmin.from('ts_oauth_sessions').insert({
            session_id: sessionId,
            api_key_id: apiKeyId,
            provider,
            client_state: clientState,
            ip_address: sha256(
                request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                request.headers.get('x-real-ip') || '0.0.0.0'
            ),
            device_fingerprint_hint: request.headers.get('user-agent') || '',
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min expiry
        });

        // Build the state parameter: sessionId|clientState
        const stateParam = clientState ? `${sessionId}|${clientState}` : sessionId;

        // Build the OAuth callback URL (our endpoint)
        const baseUrl = getBaseUrl(request);
        const callbackUrl = `${baseUrl}/api/v1/oauth/callback`;

        // Build the provider authorization URL
        let authUrl: string;

        if (provider === 'github') {
            const params = new URLSearchParams({
                client_id: config.client_id,
                redirect_uri: callbackUrl,
                scope: (config.scopes as string[]).join(' '),
                state: stateParam,
            });
            authUrl = `https://github.com/login/oauth/authorize?${params}`;
        } else {
            // Google
            const params = new URLSearchParams({
                client_id: config.client_id,
                redirect_uri: callbackUrl,
                response_type: 'code',
                scope: (config.scopes as string[]).join(' '),
                state: stateParam,
                access_type: 'online',
                prompt: 'consent',
            });
            authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
        }

        // Redirect the user to the provider
        return NextResponse.redirect(authUrl);
    } catch (error) {
        console.error('[TrialShield] OAuth authorize error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

function getBaseUrl(request: NextRequest): string {
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    return `${protocol}://${host}`;
}
