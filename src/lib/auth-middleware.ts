// TrialShield — API Authorization Middleware
// Validates API key, checks subscription status, enforces rate limits
// Must be called at the start of every API route

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashApiKey } from '@/lib/utils';

export interface AuthResult {
    authorized: boolean;
    apiKeyId: string;
    apiKeyUUID?: string;        // The ts_api_keys.id
    plan?: string;              // pending, free_trial, starter, pro, enterprise
    subscriptionStatus?: string; // pending, active, trialing, past_due, canceled, expired
    error?: string;
    errorCode?: string;
    rateLimit?: number;
}

// ─── Plans & Limits ──────────────────────────────────────────
// DEFAULT: new API keys start as 'pending' — must pay before access.
// Free trial is opt-in only (you can manually assign it to specific clients).
const PLAN_LIMITS: Record<string, { rateLimit: number; maxUsers: number; features: string[] }> = {
    pending: {
        rateLimit: 0,
        maxUsers: 0,
        features: [],  // No access until payment
    },
    free_trial: {
        rateLimit: 30,
        maxUsers: 100,
        features: ['verify', 'track'],
    },
    starter: {
        rateLimit: 120,
        maxUsers: 5000,
        features: ['verify', 'track', 'monitor', 'oauth', 'stripe'],
    },
    pro: {
        rateLimit: 600,
        maxUsers: 50000,
        features: ['verify', 'track', 'monitor', 'oauth', 'stripe', 'graph', 'compliance'],
    },
    enterprise: {
        rateLimit: 3000,
        maxUsers: -1, // unlimited
        features: ['all'],
    },
};

// ─── Main Auth Check ─────────────────────────────────────────
export async function authenticateRequest(
    request: NextRequest,
    requiredFeature?: string
): Promise<AuthResult> {
    const apiKey = request.headers.get('X-API-Key') ||
        request.headers.get('Authorization')?.replace('Bearer ', '') || '';

    if (!apiKey) {
        return {
            authorized: false,
            apiKeyId: '',
            error: 'API key required. Pass it via X-API-Key header.',
            errorCode: 'MISSING_API_KEY',
        };
    }

    const apiKeyId = hashApiKey(apiKey);

    // Look up the API key
    const { data: keyRecord } = await supabaseAdmin
        .from('ts_api_keys')
        .select('id, is_active, rate_limit, plan, subscription_status, creem_customer_id, trial_ends_at')
        .eq('hashed_key', apiKeyId)
        .single();

    if (!keyRecord) {
        return {
            authorized: false,
            apiKeyId,
            error: 'Invalid API key.',
            errorCode: 'INVALID_API_KEY',
        };
    }

    if (!keyRecord.is_active) {
        return {
            authorized: false,
            apiKeyId,
            error: 'API key is deactivated.',
            errorCode: 'INACTIVE_API_KEY',
        };
    }

    // ─── Subscription Check ──────────────────────────────────
    const plan = keyRecord.plan || 'pending';          // DEFAULT: pending (must pay first)
    const status = keyRecord.subscription_status || 'pending';

    // Block pending keys — payment required before any access
    if (plan === 'pending' || status === 'pending') {
        return {
            authorized: false,
            apiKeyId,
            plan,
            subscriptionStatus: 'pending',
            error: 'Payment required. Subscribe at your TrialShield dashboard to activate your API key.',
            errorCode: 'PAYMENT_REQUIRED',
        };
    }

    // Check if free trial has expired (opt-in only, manually assigned)
    if (plan === 'free_trial' && keyRecord.trial_ends_at) {
        const trialEnd = new Date(keyRecord.trial_ends_at);
        if (trialEnd < new Date()) {
            return {
                authorized: false,
                apiKeyId,
                plan,
                subscriptionStatus: 'expired',
                error: 'Free trial expired. Please subscribe to continue using TrialShield.',
                errorCode: 'TRIAL_EXPIRED',
            };
        }
    }

    // For paid plans: check subscription status
    if (status === 'canceled' || status === 'expired' || status === 'revoked') {
        return {
            authorized: false,
            apiKeyId,
            plan,
            subscriptionStatus: status,
            error: `Subscription ${status}. Please renew to continue using TrialShield.`,
            errorCode: 'SUBSCRIPTION_INACTIVE',
        };
    }

    // ─── Feature Check ───────────────────────────────────────
    if (requiredFeature) {
        const planConfig = PLAN_LIMITS[plan] || PLAN_LIMITS.free_trial;
        if (!planConfig.features.includes('all') && !planConfig.features.includes(requiredFeature)) {
            return {
                authorized: false,
                apiKeyId,
                plan,
                subscriptionStatus: status,
                error: `Feature "${requiredFeature}" is not available on the ${plan} plan. Please upgrade.`,
                errorCode: 'FEATURE_UNAVAILABLE',
            };
        }
    }

    // ─── Rate Limit Check ────────────────────────────────────
    const planConfig = PLAN_LIMITS[plan] || PLAN_LIMITS.free_trial;
    const rateLimit = keyRecord.rate_limit || planConfig.rateLimit;

    const windowStart = new Date();
    windowStart.setSeconds(0, 0); // Round to current minute

    const { data: rateLimitRecord } = await supabaseAdmin
        .from('ts_rate_limits')
        .select('request_count')
        .eq('api_key_id', keyRecord.id)
        .eq('window_start', windowStart.toISOString())
        .single();

    if (rateLimitRecord && rateLimitRecord.request_count >= rateLimit) {
        return {
            authorized: false,
            apiKeyId,
            plan,
            subscriptionStatus: status,
            rateLimit,
            error: `Rate limit exceeded (${rateLimit}/min). Please slow down or upgrade your plan.`,
            errorCode: 'RATE_LIMIT_EXCEEDED',
        };
    }

    // Increment rate limit counter
    await supabaseAdmin.from('ts_rate_limits').upsert({
        api_key_id: keyRecord.id,
        window_start: windowStart.toISOString(),
        request_count: (rateLimitRecord?.request_count || 0) + 1,
    }, { onConflict: 'api_key_id,window_start' });

    // Update last_used
    await supabaseAdmin.from('ts_api_keys')
        .update({
            last_used: new Date().toISOString(),
            total_requests: (keyRecord as any).total_requests + 1,
        })
        .eq('id', keyRecord.id);

    return {
        authorized: true,
        apiKeyId,
        apiKeyUUID: keyRecord.id,
        plan,
        subscriptionStatus: status,
        rateLimit,
    };
}

// ─── Utility: Build error response ───────────────────────────
export function buildAuthError(auth: AuthResult): NextResponse {
    const statusCode = auth.errorCode === 'RATE_LIMIT_EXCEEDED' ? 429 :
        auth.errorCode === 'MISSING_API_KEY' || auth.errorCode === 'INVALID_API_KEY' ? 401 :
            403;

    return NextResponse.json({
        error: auth.error,
        code: auth.errorCode,
        plan: auth.plan,
        subscriptionStatus: auth.subscriptionStatus,
    }, {
        status: statusCode,
        headers: {
            'X-RateLimit-Limit': String(auth.rateLimit || 0),
        },
    });
}

// ─── Activate subscription (called by Creem webhook) ─────────
export async function activateSubscription(
    creemCustomerId: string,
    plan: string,
    status: string
): Promise<boolean> {
    const { error } = await supabaseAdmin
        .from('ts_api_keys')
        .update({
            plan,
            subscription_status: status,
            creem_customer_id: creemCustomerId,
        })
        .eq('creem_customer_id', creemCustomerId);

    return !error;
}

// ─── Link Creem customer to API key ──────────────────────────
export async function linkCreemCustomer(
    apiKeyId: string,
    creemCustomerId: string,
    plan: string
): Promise<boolean> {
    const { error } = await supabaseAdmin
        .from('ts_api_keys')
        .update({
            creem_customer_id: creemCustomerId,
            plan,
            subscription_status: 'active',
        })
        .eq('hashed_key', apiKeyId);

    return !error;
}
