// TrialShield — Stripe Webhook Endpoint
// POST /api/v1/stripe/webhook
// Receives Stripe webhook events, validates signature, extracts card data,
// runs card fingerprint analysis, and stores results

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sha256 } from '@/lib/utils';
import { analyzeStripeCard, extractCardFromStripeEvent } from '@/services/stripe-intelligence';
import crypto from 'crypto';

// Stripe signature verification (no SDK dependency)
function verifyStripeSignature(
    payload: string,
    sigHeader: string,
    secret: string
): boolean {
    try {
        const parts = sigHeader.split(',');
        const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1];
        const signatures = parts
            .filter(p => p.startsWith('v1='))
            .map(p => p.split('=')[1]);

        if (!timestamp || signatures.length === 0) return false;

        // Check timestamp (reject events older than 5 minutes)
        const age = Math.abs(Date.now() / 1000 - parseInt(timestamp));
        if (age > 300) return false;

        // Compute expected signature
        const signedPayload = `${timestamp}.${payload}`;
        const expected = crypto
            .createHmac('sha256', secret)
            .update(signedPayload)
            .digest('hex');

        return signatures.some(sig => {
            try {
                return crypto.timingSafeEqual(
                    Buffer.from(sig, 'hex'),
                    Buffer.from(expected, 'hex')
                );
            } catch { return false; }
        });
    } catch {
        return false;
    }
}

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        const sigHeader = request.headers.get('stripe-signature') || '';

        if (!sigHeader) {
            return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
        }

        // Find the matching Stripe config by trying all active configs
        const { data: configs } = await supabaseAdmin
            .from('ts_stripe_configs')
            .select('api_key_id, webhook_secret_raw')
            .eq('is_active', true);

        if (!configs || configs.length === 0) {
            return NextResponse.json({ error: 'No Stripe webhook configured' }, { status: 404 });
        }

        // Try each config's webhook secret to find the matching one
        let matchedConfig: { api_key_id: string; webhook_secret_raw: string } | null = null;
        for (const config of configs) {
            if (verifyStripeSignature(rawBody, sigHeader, config.webhook_secret_raw)) {
                matchedConfig = config;
                break;
            }
        }

        if (!matchedConfig) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
        }

        const event = JSON.parse(rawBody);
        const eventType = event.type as string;

        // Increment event counter (best-effort)
        try {
            await supabaseAdmin.rpc('increment_stripe_events', {
                config_api_key_id: matchedConfig.api_key_id,
            });
        } catch {
            // RPC may not exist, ignore
        }

        // ─── Process relevant events ─────────────────────────────
        const relevantEvents = [
            'charge.succeeded',
            'charge.failed',
            'payment_intent.succeeded',
            'payment_method.attached',
            'setup_intent.succeeded',
        ];

        if (!relevantEvents.includes(eventType)) {
            // Not a payment event we care about — acknowledge it
            return NextResponse.json({ received: true, processed: false });
        }

        // Extract card data from the event
        const cardData = extractCardFromStripeEvent(event);

        if (!cardData) {
            return NextResponse.json({ received: true, processed: false, reason: 'no_card_data' });
        }

        // Find or create the TrialShield user from the Stripe customer
        let userId: string | undefined;
        const customerId = cardData.customerId;

        if (customerId) {
            // Try to find user by Stripe customer ID anchor
            const { data: anchor } = await supabaseAdmin
                .from('ts_identity_anchors')
                .select('user_id')
                .eq('anchor_type', 'stripe_customer')
                .eq('anchor_hash', sha256(customerId))
                .limit(1)
                .single();

            userId = anchor?.user_id;
        }

        // Run card analysis (stores fingerprints internally)
        const analysis = await analyzeStripeCard(cardData, userId);

        // Store the raw event for audit
        try {
            await supabaseAdmin.from('ts_stripe_events').insert({
                api_key_id: matchedConfig.api_key_id,
                event_type: eventType,
                stripe_event_id: event.id,
                user_id: userId || null,
                card_fingerprint_hash: cardData.cardFingerprint ? sha256(cardData.cardFingerprint) : null,
                risk_score: analysis.score,
                signals: analysis.signals,
                metadata: {
                    brand: cardData.brand,
                    last4: cardData.last4,
                    country: cardData.country,
                    funding: cardData.fundingType,
                    amount: cardData.amount,
                    currency: cardData.currency,
                },
                created_at: new Date().toISOString(),
            });
        } catch (err: unknown) {
            console.error('[TrialShield] Failed to store Stripe event:', err);
        }

        return NextResponse.json({
            received: true,
            processed: true,
            eventType,
            riskScore: analysis.score,
            signals: analysis.signals.length,
            isPrepaid: analysis.isPrepaid,
            cardReusedCount: analysis.cardReusedCount,
        });
    } catch (error) {
        console.error('[TrialShield] Stripe webhook error:', error);
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
}
