// TrialShield — Stripe Configuration Endpoint
// POST /api/v1/stripe/config — Store client's Stripe webhook secret
// GET  /api/v1/stripe/config — Retrieve current Stripe config

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

        if (!body.webhookSecret) {
            return NextResponse.json({
                error: 'webhookSecret is required (starts with whsec_)',
                code: 'MISSING_WEBHOOK_SECRET',
            }, { status: 400 });
        }

        // Upsert Stripe config
        const { error } = await supabaseAdmin.from('ts_stripe_configs').upsert({
            api_key_id: apiKeyId,
            webhook_secret_raw: body.webhookSecret,
            webhook_secret_hash: sha256(body.webhookSecret),
            stripe_api_key_raw: body.stripeSecretKey || null,
            is_active: true,
            events_listening: body.events || [
                'charge.succeeded',
                'charge.failed',
                'payment_intent.succeeded',
                'payment_method.attached',
                'customer.created',
                'setup_intent.succeeded',
            ],
            updated_at: new Date().toISOString(),
        }, { onConflict: 'api_key_id' });

        if (error) {
            console.error('[TrialShield] Stripe config save failed:', error);
            return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
        }

        const baseUrl = getBaseUrl(request);

        return NextResponse.json({
            success: true,
            webhookUrl: `${baseUrl}/api/v1/stripe/webhook`,
            message: 'Stripe configured. Add the webhook URL to your Stripe Dashboard.',
            events: body.events || [
                'charge.succeeded', 'charge.failed', 'payment_intent.succeeded',
                'payment_method.attached', 'customer.created', 'setup_intent.succeeded',
            ],
        });
    } catch (error) {
        console.error('[TrialShield] Stripe config error:', error);
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
            .from('ts_stripe_configs')
            .select('is_active, events_listening, updated_at, total_events_received')
            .eq('api_key_id', apiKeyId)
            .single();

        return NextResponse.json({
            configured: !!data,
            ...(data || {}),
        });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
