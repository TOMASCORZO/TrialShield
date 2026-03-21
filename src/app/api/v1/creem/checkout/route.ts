// TrialShield — Creem Checkout Session Creator
// POST /api/v1/creem/checkout
// Creates a Creem checkout URL for the authenticated user

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Map plan names to Creem product IDs
// UPDATE THESE with your actual Creem product IDs from https://creem.io/dashboard
const PLAN_PRODUCT_IDS: Record<string, string> = {
    starter: process.env.CREEM_PRODUCT_STARTER || '',
    pro: process.env.CREEM_PRODUCT_PRO || '',
    enterprise: process.env.CREEM_PRODUCT_ENTERPRISE || '',
};

export async function POST(request: NextRequest) {
    try {
        // Authenticate via JWT session token
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.replace('Bearer ', '');

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const planId = body.plan;

        if (!planId || !PLAN_PRODUCT_IDS[planId]) {
            return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
        }

        const productId = PLAN_PRODUCT_IDS[planId];
        if (!productId) {
            return NextResponse.json({
                error: 'Plan not configured. Set CREEM_PRODUCT_STARTER and CREEM_PRODUCT_PRO in environment variables.'
            }, { status: 500 });
        }

        // Find the user's API key to pass as reference
        const { data: apiKey } = await supabaseAdmin
            .from('ts_api_keys')
            .select('id')
            .eq('owner_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        const creemApiKey = process.env.CREEM_API_KEY;
        if (!creemApiKey) {
            return NextResponse.json({ error: 'Creem API key not configured' }, { status: 500 });
        }

        // Determine base URL for Creem API
        const isTest = creemApiKey.startsWith('creem_test_');
        const creemBaseUrl = isTest ? 'https://test-api.creem.io' : 'https://api.creem.io';

        // Get the app's base URL for success redirect
        const host = request.headers.get('host') || 'localhost:3000';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const baseUrl = `${protocol}://${host}`;

        // Create checkout via Creem API
        const checkoutRes = await fetch(`${creemBaseUrl}/v1/checkouts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': creemApiKey,
            },
            body: JSON.stringify({
                productId,
                successUrl: `${baseUrl}/dashboard/billing?success=true`,
                customer: {
                    email: user.email,
                },
                metadata: {
                    referenceId: apiKey?.id || '',
                    userId: user.id,
                    plan: planId,
                },
            }),
        });

        if (!checkoutRes.ok) {
            const errData = await checkoutRes.json().catch(() => ({}));
            console.error('[TrialShield] Creem checkout error:', errData);
            return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
        }

        const checkoutData = await checkoutRes.json();

        return NextResponse.json({
            checkoutUrl: checkoutData.checkout_url || checkoutData.checkoutUrl,
        });
    } catch (error) {
        console.error('[TrialShield] Checkout error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
