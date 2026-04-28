// TrialShield — API Middleware
// Responsibilities:
//   1. Per-route CORS (dashboard endpoints restricted, public endpoints open)
//   2. API key validation for endpoints that require it
//
// Per-route auth (Supabase JWT, ownership checks, etc.) lives in each handler.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashApiKey } from '@/lib/utils';

// Endpoints that should only be reachable from our own dashboard origin.
// Anything else (verify, track, monitor, kyc submit/session, webhooks, sdk, docs)
// is intentionally cross-origin friendly.
const DASHBOARD_ONLY_PREFIXES = [
    '/api/v1/keys',
    '/api/v1/dashboard',
    '/api/v1/stats',
    '/api/v1/settings',
    '/api/v1/users',
    '/api/v1/billing',
    '/api/v1/admin',
    '/api/v1/creem/checkout',
    '/api/v1/stripe/config',
];

const ALLOWED_DASHBOARD_ORIGINS = new Set<string>([
    'https://trialshield.cc',
    'https://www.trialshield.cc',
    'http://localhost:3000',
    'http://localhost:3001',
]);

function resolveCorsOrigin(pathname: string, requestOrigin: string | null): string {
    const isDashboardScoped = DASHBOARD_ONLY_PREFIXES.some(p => pathname.startsWith(p));
    if (!isDashboardScoped) return '*';

    if (requestOrigin && ALLOWED_DASHBOARD_ORIGINS.has(requestOrigin)) {
        return requestOrigin;
    }

    // Allow any preview/production deployment of this Vercel project.
    if (requestOrigin && /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(requestOrigin)) {
        return requestOrigin;
    }

    // No match — return our canonical origin so browsers reject other callers.
    return 'https://trialshield.cc';
}

function buildCorsHeaders(allowOrigin: string): Record<string, string> {
    return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
    };
}

// Endpoints that pass through this middleware without an X-API-Key check.
// Their handlers either validate a Supabase JWT, a session UUID, or a webhook signature.
const SKIP_API_KEY_PREFIXES = [
    '/api/v1/health',
    '/api/v1/docs',
    '/api/v1/sdk',
    '/api/v1/dashboard',
    '/api/v1/stats',
    '/api/v1/creem',
    '/api/v1/keys',
    '/api/v1/billing',
    '/api/v1/admin',
    '/api/v1/kyc/submit',
    '/api/v1/kyc/session/',
    '/api/v1/stripe/webhook',
];

export async function middleware(request: NextRequest) {
    const startTime = Date.now();
    const pathname = request.nextUrl.pathname;
    const requestOrigin = request.headers.get('origin');

    if (!pathname.startsWith('/api/v1')) {
        return NextResponse.next();
    }

    const corsHeaders = buildCorsHeaders(resolveCorsOrigin(pathname, requestOrigin));

    // CORS preflight
    if (request.method === 'OPTIONS') {
        return new NextResponse(null, { status: 204, headers: corsHeaders });
    }

    // Skip API key check for the health endpoint and other handler-authenticated routes.
    if (pathname === '/api/v1/health' ||
        SKIP_API_KEY_PREFIXES.some(p => pathname.startsWith(p))) {
        const passthrough = NextResponse.next();
        for (const [k, v] of Object.entries(corsHeaders)) passthrough.headers.set(k, v);
        return passthrough;
    }

    // Require an API key for everything else
    const apiKey = request.headers.get('X-API-Key') ||
        request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!apiKey) {
        return NextResponse.json(
            { error: 'Missing API key. Provide via X-API-Key header or Authorization: Bearer <key>' },
            { status: 401, headers: corsHeaders }
        );
    }

    const masterKey = process.env.TRIALSHIELD_MASTER_KEY;
    const isMasterKey = masterKey && apiKey === masterKey;

    if (!isMasterKey) {
        try {
            const hashedKey = hashApiKey(apiKey);
            const { data: keyRecord } = await supabaseAdmin
                .from('ts_api_keys')
                .select('id, rate_limit, is_active, total_requests')
                .eq('hashed_key', hashedKey)
                .single();

            if (!keyRecord || !keyRecord.is_active) {
                return NextResponse.json(
                    { error: 'Invalid or inactive API key' },
                    { status: 401, headers: corsHeaders }
                );
            }

            await supabaseAdmin
                .from('ts_api_keys')
                .update({
                    last_used: new Date().toISOString(),
                    total_requests: (keyRecord.total_requests || 0) + 1,
                })
                .eq('id', keyRecord.id);
        } catch (error) {
            console.error('[Middleware] API key validation error:', error);
            return NextResponse.json(
                { error: 'API key validation failed' },
                { status: 500, headers: corsHeaders }
            );
        }
    }

    const response = NextResponse.next();
    for (const [k, v] of Object.entries(corsHeaders)) response.headers.set(k, v);
    response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`);
    response.headers.set('X-Powered-By', 'TrialShield');
    return response;
}

export const config = {
    matcher: '/api/:path*',
};
