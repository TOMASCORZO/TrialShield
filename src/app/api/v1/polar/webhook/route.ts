// TrialShield — Polar.sh Webhook Endpoint
// POST /api/v1/polar/webhook
// Handles subscription lifecycle events from Polar.sh:
// - subscription.created → activate client API key
// - subscription.updated → update plan/status
// - subscription.canceled → mark as canceled
// - subscription.revoked → block access
// - order.created → log payment
//
// Uses Standard Webhooks signature verification

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

// ─── Standard Webhooks signature verification ─────────────────
function verifyPolarSignature(
    payload: string,
    sigHeader: string,
    secret: string
): boolean {
    try {
        // Polar uses Standard Webhooks format: "v1,<base64-signature>"
        // Header: webhook-id, webhook-timestamp, webhook-signature
        const parts = sigHeader.split(' ');
        for (const part of parts) {
            const [version, sig] = part.split(',');
            if (version === 'v1' && sig) {
                // For Standard Webhooks, the secret is base64-encoded
                const secretBytes = Buffer.from(secret.replace('whsec_', ''), 'base64');
                const webhookId = '';  // From webhook-id header
                const timestamp = '';  // From webhook-timestamp header
                const toSign = `${webhookId}.${timestamp}.${payload}`;
                const expected = crypto
                    .createHmac('sha256', secretBytes)
                    .update(toSign)
                    .digest('base64');
                if (sig === expected) return true;
            }
        }
        return false;
    } catch {
        return false;
    }
}

// ─── Plan Mapping ────────────────────────────────────────────
function mapPolarProductToPlan(productName: string): string {
    const name = productName.toLowerCase();
    if (name.includes('enterprise')) return 'enterprise';
    if (name.includes('pro')) return 'pro';
    if (name.includes('starter') || name.includes('basic')) return 'starter';
    return 'starter';
}

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        const webhookId = request.headers.get('webhook-id') || '';
        const webhookTimestamp = request.headers.get('webhook-timestamp') || '';
        const webhookSignature = request.headers.get('webhook-signature') || '';

        // Load Polar webhook secret from config
        const { data: polarConfig } = await supabaseAdmin
            .from('ts_polar_config')
            .select('webhook_secret')
            .limit(1)
            .single();

        // Verify signature if secret is configured
        if (polarConfig?.webhook_secret && webhookSignature) {
            const toSign = `${webhookId}.${webhookTimestamp}.${rawBody}`;
            const secretBytes = Buffer.from(
                polarConfig.webhook_secret.replace('whsec_', ''),
                'base64'
            );
            const expectedSig = crypto
                .createHmac('sha256', secretBytes)
                .update(toSign)
                .digest('base64');

            const receivedSigs = webhookSignature.split(' ');
            const valid = receivedSigs.some(s => {
                const [, sig] = s.split(',');
                return sig === expectedSig;
            });

            if (!valid) {
                return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
            }
        }

        const event = JSON.parse(rawBody);
        const eventType = event.type as string;
        const data = event.data;

        console.log(`[TrialShield] Polar webhook: ${eventType}`);

        switch (eventType) {
            case 'subscription.created':
            case 'subscription.updated': {
                const polarCustomerId = data.customer_id;
                const status = data.status; // active, past_due, canceled, revoked, etc.
                const productName = data.product?.name || data.product_id || '';
                const plan = mapPolarProductToPlan(productName);

                // Find API key linked to this Polar customer
                const { data: apiKey } = await supabaseAdmin
                    .from('ts_api_keys')
                    .select('id')
                    .eq('polar_customer_id', polarCustomerId)
                    .single();

                if (apiKey) {
                    // Update existing linked key
                    await supabaseAdmin.from('ts_api_keys').update({
                        plan,
                        subscription_status: status,
                        polar_subscription_id: data.id,
                    }).eq('id', apiKey.id);
                } else {
                    // Customer may not be linked yet — store for later linking
                    await supabaseAdmin.from('ts_polar_customers').upsert({
                        polar_customer_id: polarCustomerId,
                        polar_subscription_id: data.id,
                        plan,
                        status,
                        email: data.customer?.email,
                        product_name: productName,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'polar_customer_id' });
                }
                break;
            }

            case 'subscription.canceled':
            case 'subscription.revoked': {
                const polarCustomerId = data.customer_id;
                const newStatus = eventType === 'subscription.canceled' ? 'canceled' : 'revoked';

                await supabaseAdmin.from('ts_api_keys')
                    .update({ subscription_status: newStatus })
                    .eq('polar_customer_id', polarCustomerId);

                await supabaseAdmin.from('ts_polar_customers')
                    .update({ status: newStatus, updated_at: new Date().toISOString() })
                    .eq('polar_customer_id', polarCustomerId);
                break;
            }

            case 'order.created': {
                // Log the payment for reference
                await supabaseAdmin.from('ts_polar_payments').insert({
                    polar_customer_id: data.customer_id,
                    polar_order_id: data.id,
                    amount: data.amount,
                    currency: data.currency,
                    status: data.status,
                    product_name: data.product?.name,
                    created_at: new Date().toISOString(),
                });
                break;
            }

            case 'customer.created':
            case 'customer.updated': {
                await supabaseAdmin.from('ts_polar_customers').upsert({
                    polar_customer_id: data.id,
                    email: data.email,
                    name: data.name,
                    status: 'active',
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'polar_customer_id' });
                break;
            }
        }

        return NextResponse.json({ received: true, event: eventType });
    } catch (error) {
        console.error('[TrialShield] Polar webhook error:', error);
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
}
