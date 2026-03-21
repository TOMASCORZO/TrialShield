// TrialShield — Creem.io Webhook Endpoint
// POST /api/v1/creem/webhook
// Handles subscription lifecycle events from Creem:
// - checkout.completed → activate client API key
// - subscription.active / subscription.paid → confirm active
// - subscription.canceled / subscription.expired → revoke access
// - subscription.paused → pause access
// - subscription.past_due → warn

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

// ─── Creem HMAC-SHA256 signature verification ────────────────
function verifyCreemSignature(
    payload: string,
    signature: string,
    secret: string
): boolean {
    try {
        const expected = crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expected)
        );
    } catch {
        return false;
    }
}

// ─── Plan Mapping ────────────────────────────────────────────
function mapCreemProductToPlan(productName: string): string {
    const name = (productName || '').toLowerCase();
    if (name.includes('enterprise')) return 'enterprise';
    if (name.includes('pro')) return 'pro';
    if (name.includes('starter') || name.includes('basic')) return 'starter';
    return 'starter';
}

// ─── Map Creem status to TrialShield status ──────────────────
function mapCreemStatus(eventType: string, creemStatus?: string): string {
    switch (eventType) {
        case 'checkout.completed':
        case 'subscription.active':
        case 'subscription.paid':
            return 'active';
        case 'subscription.trialing':
            return 'trialing';
        case 'subscription.paused':
            return 'paused';
        case 'subscription.past_due':
            return 'past_due';
        case 'subscription.canceled':
        case 'subscription.scheduled_cancel':
            return 'canceled';
        case 'subscription.expired':
            return 'expired';
        default:
            return creemStatus || 'active';
    }
}

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        const signature = request.headers.get('creem-signature') || '';

        const webhookSecret = process.env.CREEM_WEBHOOK_SECRET;

        // Verify signature if secret is configured
        if (webhookSecret && signature) {
            if (!verifyCreemSignature(rawBody, signature, webhookSecret)) {
                console.error('[TrialShield] Creem webhook signature verification failed');
                return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
            }
        }

        const event = JSON.parse(rawBody);
        const eventType = event.eventType as string;
        const data = event.object;

        console.log(`[TrialShield] Creem webhook: ${eventType}`, { eventId: event.id });

        // ─── Access Grant Events ─────────────────────────────────
        const grantEvents = [
            'checkout.completed',
            'subscription.active',
            'subscription.trialing',
            'subscription.paid',
        ];

        // ─── Access Revoke Events ────────────────────────────────
        const revokeEvents = [
            'subscription.paused',
            'subscription.expired',
            'subscription.canceled',
            'subscription.scheduled_cancel',
            'subscription.past_due',
        ];

        if (grantEvents.includes(eventType)) {
            const customerId = data?.customer?.id || data?.customer_id;
            const customerEmail = data?.customer?.email;
            const productName = data?.product?.name || '';
            const plan = mapCreemProductToPlan(productName);
            const status = mapCreemStatus(eventType);
            const subscriptionId = data?.subscription?.id || data?.id;
            const referenceId = data?.metadata?.referenceId || data?.metadata?.apiKeyId;

            // Strategy 1: Find API key by referenceId (passed in checkout metadata)
            if (referenceId) {
                await supabaseAdmin.from('ts_api_keys').update({
                    plan,
                    subscription_status: status,
                    creem_customer_id: customerId,
                    creem_subscription_id: subscriptionId,
                }).eq('id', referenceId);
            }
            // Strategy 2: Find API key by creem_customer_id (returning customer)
            else if (customerId) {
                const { data: existingKey } = await supabaseAdmin
                    .from('ts_api_keys')
                    .select('id')
                    .eq('creem_customer_id', customerId)
                    .single();

                if (existingKey) {
                    await supabaseAdmin.from('ts_api_keys').update({
                        plan,
                        subscription_status: status,
                        creem_subscription_id: subscriptionId,
                    }).eq('id', existingKey.id);
                }
                // Strategy 3: Find by owner email
                else if (customerEmail) {
                    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
                    const user = users?.find(u => u.email === customerEmail);

                    if (user) {
                        // Find the user's most recent API key
                        const { data: userKey } = await supabaseAdmin
                            .from('ts_api_keys')
                            .select('id')
                            .eq('owner_id', user.id)
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .single();

                        if (userKey) {
                            await supabaseAdmin.from('ts_api_keys').update({
                                plan,
                                subscription_status: status,
                                creem_customer_id: customerId,
                                creem_subscription_id: subscriptionId,
                            }).eq('id', userKey.id);
                        }
                    }
                }
            }

            // Store/update customer record
            if (customerId) {
                await supabaseAdmin.from('ts_creem_customers').upsert({
                    creem_customer_id: customerId,
                    email: customerEmail,
                    plan,
                    status,
                    subscription_id: subscriptionId,
                    product_name: productName,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'creem_customer_id' });
            }
        }

        if (revokeEvents.includes(eventType)) {
            const customerId = data?.customer?.id || data?.customer_id;
            const status = mapCreemStatus(eventType);

            if (customerId) {
                await supabaseAdmin.from('ts_api_keys')
                    .update({ subscription_status: status })
                    .eq('creem_customer_id', customerId);

                await supabaseAdmin.from('ts_creem_customers')
                    .update({ status, updated_at: new Date().toISOString() })
                    .eq('creem_customer_id', customerId);
            }
        }

        // Log refunds and disputes
        if (eventType === 'refund.created' || eventType === 'dispute.created') {
            const customerId = data?.customer?.id || data?.customer_id;
            console.warn(`[TrialShield] Creem ${eventType} for customer ${customerId}`, data);
        }

        return NextResponse.json({ received: true, event: eventType });
    } catch (error) {
        console.error('[TrialShield] Creem webhook error:', error);
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
}
