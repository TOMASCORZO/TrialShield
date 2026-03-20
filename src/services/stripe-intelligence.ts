// TrialShield — Stripe Card Intelligence Service
// Extracts card fingerprinting data from Stripe webhook events:
// - Card fingerprint (Stripe's unique card identifier)
// - BIN (first 6-8 digits), last4, brand, country
// - Funding type (credit, debit, prepaid)
// - Address verification (AVS), CVC check results
// - Risk level from Stripe Radar
// All data is stored in ts_payment_fingerprints for graph analysis

import { RiskSignal } from '@/types';
import { supabaseAdmin } from '@/lib/supabase';
import { sha256 } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────
export interface StripeCardData {
    // From Stripe charge/payment_intent
    cardFingerprint?: string;     // Stripe's unique card fingerprint
    bin?: string;                 // First 6-8 digits (IIN)
    last4?: string;
    brand?: string;               // visa, mastercard, amex, etc.
    country?: string;             // Card issuing country (2-letter ISO)
    fundingType?: string;         // credit, debit, prepaid
    expMonth?: number;
    expYear?: number;
    // Verification results
    cvcCheck?: string;            // pass, fail, unavailable, unchecked
    addressLine1Check?: string;
    addressZipCheck?: string;
    // Stripe risk signals
    riskLevel?: string;           // normal, elevated, highest
    riskScore?: number;           // Stripe Radar score (0-100)
    // Payment metadata
    amount?: number;
    currency?: string;
    customerId?: string;
    chargeId?: string;
    paymentIntentId?: string;
    // Billing address
    billingName?: string;
    billingZip?: string;
    billingCountry?: string;
}

export interface StripeCardAnalysis {
    score: number;
    signals: RiskSignal[];
    cardFingerprint: string | null;
    isPrepaid: boolean;
    cardReusedCount: number;
    binReusedCount: number;
}

// ─── Configuration ────────────────────────────────────────────
const STRIPE_CONFIG = {
    prepaidPenalty: 25,           // Prepaid cards are common for trial abuse
    cvcFailPenalty: 15,
    avsFailPenalty: 10,
    stripeHighRiskPenalty: 30,
    stripeElevatedPenalty: 15,
    cardReusedPenalty: 40,        // Same card fingerprint across users
    binReusedPenalty: 20,         // Same BIN (first 6 digits) across users
    countryMismatchPenalty: 15,   // Card country ≠ billing country
    lowAmountPenalty: 10,         // Suspiciously low payment (testing the card)
    lowAmountThreshold: 1.00,    // Under $1 = suspicious
};

// ─── Main Analysis (called from webhook) ─────────────────────
export async function analyzeStripeCard(
    card: StripeCardData,
    userId?: string
): Promise<StripeCardAnalysis> {
    const signals: RiskSignal[] = [];
    let score = 0;

    const cardFingerprint = card.cardFingerprint || null;
    let isPrepaid = false;
    let cardReusedCount = 0;
    let binReusedCount = 0;

    // ─── 1. Prepaid card detection ───────────────────────────
    if (card.fundingType === 'prepaid') {
        isPrepaid = true;
        score += STRIPE_CONFIG.prepaidPenalty;
        signals.push({
            module: 'GRAPH', signal: 'PREPAID_CARD', severity: 'HIGH',
            description: 'Prepaid/gift card used — common for trial abuse',
        });
    }

    // ─── 2. Card fingerprint reuse (strongest signal) ────────
    if (cardFingerprint) {
        const { count } = await supabaseAdmin
            .from('ts_payment_fingerprints')
            .select('*', { count: 'exact', head: true })
            .eq('card_fingerprint_hash', sha256(cardFingerprint));

        cardReusedCount = count || 0;

        if (cardReusedCount > 1) {
            score += STRIPE_CONFIG.cardReusedPenalty;
            signals.push({
                module: 'GRAPH', signal: 'CARD_FINGERPRINT_REUSE', severity: 'CRITICAL',
                description: `Same card fingerprint seen across ${cardReusedCount} accounts — definite duplicate`,
                value: cardReusedCount,
            });
        }
    }

    // ─── 3. BIN reuse analysis ───────────────────────────────
    if (card.bin) {
        const binHash = sha256(card.bin);
        const { count } = await supabaseAdmin
            .from('ts_payment_fingerprints')
            .select('*', { count: 'exact', head: true })
            .eq('bin_hash', binHash);

        binReusedCount = count || 0;

        if (binReusedCount > 3) {
            score += STRIPE_CONFIG.binReusedPenalty;
            signals.push({
                module: 'GRAPH', signal: 'BIN_CLUSTER', severity: 'HIGH',
                description: `Same card BIN used across ${binReusedCount} accounts`,
                value: binReusedCount,
            });
        }
    }

    // ─── 4. Stripe Radar risk level ──────────────────────────
    if (card.riskLevel === 'highest') {
        score += STRIPE_CONFIG.stripeHighRiskPenalty;
        signals.push({
            module: 'GRAPH', signal: 'STRIPE_HIGH_RISK', severity: 'CRITICAL',
            description: 'Stripe Radar flagged this payment as highest risk',
        });
    } else if (card.riskLevel === 'elevated') {
        score += STRIPE_CONFIG.stripeElevatedPenalty;
        signals.push({
            module: 'GRAPH', signal: 'STRIPE_ELEVATED_RISK', severity: 'HIGH',
            description: 'Stripe Radar flagged this payment as elevated risk',
        });
    }

    // ─── 5. Verification failures ────────────────────────────
    if (card.cvcCheck === 'fail') {
        score += STRIPE_CONFIG.cvcFailPenalty;
        signals.push({
            module: 'GRAPH', signal: 'CVC_CHECK_FAILED', severity: 'HIGH',
            description: 'Card CVC verification failed',
        });
    }

    if (card.addressZipCheck === 'fail' || card.addressLine1Check === 'fail') {
        score += STRIPE_CONFIG.avsFailPenalty;
        signals.push({
            module: 'GRAPH', signal: 'AVS_CHECK_FAILED', severity: 'MEDIUM',
            description: 'Address verification (AVS) failed — billing address mismatch',
        });
    }

    // ─── 6. Country mismatch ─────────────────────────────────
    if (card.country && card.billingCountry &&
        card.country.toUpperCase() !== card.billingCountry.toUpperCase()) {
        score += STRIPE_CONFIG.countryMismatchPenalty;
        signals.push({
            module: 'GRAPH', signal: 'CARD_COUNTRY_MISMATCH', severity: 'MEDIUM',
            description: `Card issued in ${card.country} but billing address in ${card.billingCountry}`,
        });
    }

    // ─── 7. Suspiciously low payment amount ──────────────────
    if (card.amount !== undefined && card.amount > 0 && card.amount < STRIPE_CONFIG.lowAmountThreshold * 100) {
        score += STRIPE_CONFIG.lowAmountPenalty;
        signals.push({
            module: 'GRAPH', signal: 'LOW_PAYMENT_AMOUNT', severity: 'MEDIUM',
            description: `Payment amount $${(card.amount / 100).toFixed(2)} is suspiciously low — possible card testing`,
            value: card.amount / 100,
        });
    }

    // ─── 8. Store card fingerprint data ──────────────────────
    if (userId) {
        await storeCardFingerprint(userId, card);
    }

    return {
        score: Math.max(0, Math.min(100, score)),
        signals,
        cardFingerprint,
        isPrepaid,
        cardReusedCount,
        binReusedCount,
    };
}

// ─── Store card fingerprint in DB ────────────────────────────
async function storeCardFingerprint(userId: string, card: StripeCardData): Promise<void> {
    try {
        const binHash = card.bin ? sha256(card.bin) : null;
        const fpHash = card.cardFingerprint ? sha256(card.cardFingerprint) : null;

        await supabaseAdmin.from('ts_payment_fingerprints').upsert({
            user_id: userId,
            bin_hash: binHash || sha256(`${card.last4}_${card.brand}`),
            card_fingerprint_hash: fpHash,
            last4: card.last4,
            brand: card.brand,
            card_country: card.country,
            funding_type: card.fundingType,
            cvc_check: card.cvcCheck,
            avs_check: card.addressZipCheck,
            stripe_risk_level: card.riskLevel,
            stripe_risk_score: card.riskScore,
            billing_zip_hash: card.billingZip ? sha256(card.billingZip) : null,
            billing_country: card.billingCountry,
            stripe_customer_id: card.customerId,
            last_seen: new Date().toISOString(),
        }, { onConflict: 'user_id,bin_hash' });

        // Also store as identity anchor if fingerprint available
        if (fpHash) {
            await supabaseAdmin.from('ts_identity_anchors').upsert({
                user_id: userId,
                anchor_type: 'card_fingerprint',
                anchor_hash: fpHash,
                confidence: 0.95,
                last_seen: new Date().toISOString(),
            }, { onConflict: 'user_id,anchor_type,anchor_hash' });
        }
    } catch (err) {
        console.error('[TrialShield] Failed to store card fingerprint:', err);
    }
}

// ─── Extract card data from Stripe event ─────────────────────
export function extractCardFromStripeEvent(event: Record<string, any>): StripeCardData | null {
    try {
        const obj = event.data?.object;
        if (!obj) return null;

        // Handle charge object
        const card = obj.payment_method_details?.card || obj.source || {};
        const outcome = obj.outcome || {};

        return {
            cardFingerprint: card.fingerprint || obj.source?.fingerprint,
            bin: card.iin || card.dynamic_last4 ? undefined : undefined, // Stripe doesn't always expose BIN
            last4: card.last4 || obj.source?.last4,
            brand: card.brand || obj.source?.brand,
            country: card.country || obj.source?.country,
            fundingType: card.funding,
            expMonth: card.exp_month,
            expYear: card.exp_year,
            cvcCheck: card.checks?.cvc_check || obj.source?.cvc_check,
            addressLine1Check: card.checks?.address_line1_check || obj.source?.address_line1_check,
            addressZipCheck: card.checks?.address_zip_check || obj.source?.address_zip_check,
            riskLevel: outcome.risk_level,
            riskScore: outcome.risk_score,
            amount: obj.amount,
            currency: obj.currency,
            customerId: obj.customer,
            chargeId: obj.id,
            paymentIntentId: obj.payment_intent,
            billingName: obj.billing_details?.name,
            billingZip: obj.billing_details?.address?.postal_code,
            billingCountry: obj.billing_details?.address?.country,
        };
    } catch {
        return null;
    }
}
