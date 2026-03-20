// TrialShield — OAuth Callback Endpoint
// GET /api/v1/oauth/callback?code=xxx&state=sessionId|clientState
// 1. Validates CSRF state
// 2. Exchanges authorization code for access token
// 3. Auto-fetches provider metadata (account age, repos, etc.)
// 4. Runs risk analysis
// 5. Redirects to client's redirectUri with risk assessment

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { analyzeOAuth, OAuthData } from '@/services/oauth-intelligence';
import { sha256 } from '@/lib/utils';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state') || '';
        const error = searchParams.get('error');

        // Handle provider errors (user denied consent)
        if (error) {
            return buildErrorRedirect(state, 'oauth_denied', `User denied OAuth consent: ${error}`);
        }

        if (!code) {
            return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
        }

        // ─── 1. Validate CSRF state ──────────────────────────────
        const [sessionId, clientState] = state.includes('|')
            ? [state.split('|')[0], state.split('|').slice(1).join('|')]
            : [state, ''];

        const { data: session } = await supabaseAdmin
            .from('ts_oauth_sessions')
            .select('*')
            .eq('session_id', sessionId)
            .single();

        if (!session) {
            return NextResponse.json({
                error: 'Invalid or expired OAuth session',
                code: 'INVALID_SESSION',
            }, { status: 400 });
        }

        // Check if session expired (10 min)
        if (new Date(session.expires_at) < new Date()) {
            await supabaseAdmin.from('ts_oauth_sessions').delete().eq('session_id', sessionId);
            return NextResponse.json({ error: 'OAuth session expired' }, { status: 400 });
        }

        const provider = session.provider;
        const apiKeyId = session.api_key_id;

        // ─── 2. Fetch OAuth config (client credentials) ──────────
        const { data: config } = await supabaseAdmin
            .from('ts_oauth_configs')
            .select('client_id, client_secret_raw, redirect_uri, scopes')
            .eq('api_key_id', apiKeyId)
            .eq('provider', provider)
            .single();

        if (!config) {
            return NextResponse.json({ error: 'OAuth config not found' }, { status: 500 });
        }

        // ─── 3. Exchange code for access token ───────────────────
        const baseUrl = getBaseUrl(request);
        const callbackUrl = `${baseUrl}/api/v1/oauth/callback`;

        let accessToken: string;
        let tokenData: Record<string, unknown> = {};

        if (provider === 'github') {
            const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    client_id: config.client_id,
                    client_secret: config.client_secret_raw,
                    code,
                    redirect_uri: callbackUrl,
                }),
                signal: AbortSignal.timeout(10000),
            });

            tokenData = await tokenResponse.json();
            accessToken = tokenData.access_token as string;
        } else {
            // Google
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: config.client_id,
                    client_secret: config.client_secret_raw,
                    code,
                    grant_type: 'authorization_code',
                    redirect_uri: callbackUrl,
                }),
                signal: AbortSignal.timeout(10000),
            });

            tokenData = await tokenResponse.json();
            accessToken = tokenData.access_token as string;
        }

        if (!accessToken) {
            console.error('[TrialShield] Token exchange failed:', tokenData);
            return redirectToClient(config.redirect_uri, {
                error: 'token_exchange_failed',
                message: 'Failed to exchange authorization code',
                state: clientState,
            });
        }

        // ─── 4. Auto-analyze with OAuth Intelligence ─────────────
        const oauthData: OAuthData = {
            provider: provider as 'google' | 'github',
            accessToken,
        };

        const analysis = await analyzeOAuth(oauthData);

        // ─── 5. Clean up session ─────────────────────────────────
        await supabaseAdmin.from('ts_oauth_sessions').delete().eq('session_id', sessionId);

        // ─── 6. Build response and redirect to client ────────────
        const redirectData: Record<string, string> = {
            // User profile data
            provider,
            provider_id: analysis.resolvedMetadata?.providerId || '',
            email: analysis.resolvedMetadata?.email || '',
            name: analysis.resolvedMetadata?.name || '',
            avatar_url: analysis.resolvedMetadata?.avatarUrl || '',
            verified: String(analysis.isVerified),
            // Account age data
            account_age_days: String(analysis.accountAgeDays ?? 'unknown'),
            is_new_account: String(analysis.isNewAccount),
            is_very_new_account: String(analysis.isVeryNewAccount),
            // Risk assessment
            oauth_risk_score: String(analysis.score),
            risk_signals: JSON.stringify(analysis.signals.map(s => ({
                signal: s.signal,
                severity: s.severity,
                description: s.description,
            }))),
            // Client state passthrough
            state: clientState,
            // Access token (client may need it for their own purposes)
            access_token: accessToken,
        };

        // GitHub-specific extras
        if (provider === 'github' && analysis.resolvedMetadata) {
            redirectData.github_username = analysis.resolvedMetadata.githubUsername || '';
            redirectData.github_repos = String(analysis.resolvedMetadata.githubPublicRepos ?? 0);
            redirectData.github_followers = String(analysis.resolvedMetadata.githubFollowers ?? 0);
            redirectData.github_created_at = analysis.resolvedMetadata.githubCreatedAt || '';
        }

        // Google-specific extras
        if (provider === 'google' && analysis.resolvedMetadata) {
            redirectData.google_created_at = analysis.resolvedMetadata.googleDriveCreatedAt || '';
        }

        return redirectToClient(config.redirect_uri, redirectData);
    } catch (err) {
        console.error('[TrialShield] OAuth callback error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ─── Helpers ─────────────────────────────────────────────────

function redirectToClient(
    baseRedirectUri: string,
    params: Record<string, string>
): NextResponse {
    const url = new URL(baseRedirectUri);
    for (const [key, value] of Object.entries(params)) {
        if (value) url.searchParams.set(key, value);
    }
    return NextResponse.redirect(url.toString());
}

function buildErrorRedirect(
    state: string,
    errorCode: string,
    message: string
): NextResponse {
    // If we can extract a session → find the redirect URI
    // Otherwise return JSON error
    return NextResponse.json({
        error: errorCode,
        message,
        state,
    }, { status: 400 });
}

function getBaseUrl(request: NextRequest): string {
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    return `${protocol}://${host}`;
}
