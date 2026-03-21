// TrialShield — API Middleware
// Rate limiting, API key validation, CORS, response timing

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashApiKey } from '@/lib/utils';

export async function middleware(request: NextRequest) {
    const startTime = Date.now();

    // Skip middleware for non-API routes and health check
    if (!request.nextUrl.pathname.startsWith('/api/v1') ||
        request.nextUrl.pathname === '/api/v1/health') {
        return NextResponse.next();
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return new NextResponse(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
                'Access-Control-Max-Age': '86400',
            },
        });
    }

    // Skip auth for public endpoints and dashboard routes (which use session auth or are public in MVP)
    const publicPaths = ['/api/v1/health', '/api/v1/docs', '/api/v1/sdk', '/api/v1/dashboard', '/api/v1/stats'];
    if (publicPaths.some(p => request.nextUrl.pathname.startsWith(p))) {
        return NextResponse.next();
    }

    // Check for API key
    const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!apiKey) {
        return NextResponse.json(
            { error: 'Missing API key. Provide via X-API-Key header or Authorization: Bearer <key>' },
            { status: 401 }
        );
    }

    // Validate API key against master key or database
    const masterKey = process.env.TRIALSHIELD_MASTER_KEY;
    const isMasterKey = apiKey === masterKey;

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
                    { status: 401 }
                );
            }

            // Update last used
            await supabaseAdmin
                .from('ts_api_keys')
                .update({
                    last_used: new Date().toISOString(),
                    total_requests: (keyRecord.total_requests || 0) + 1
                })
                .eq('id', keyRecord.id);

        } catch (error) {
            console.error('[Middleware] API key validation error:', error);
            return NextResponse.json(
                { error: 'API key validation failed' },
                { status: 500 }
            );
        }
    }

    // Add timing header
    const response = NextResponse.next();
    response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`);
    response.headers.set('X-Powered-By', 'TrialShield');

    return response;
}

export const config = {
    matcher: '/api/:path*',
};
