// TrialShield — Billing status helper
// Aggregates subscription state for a dashboard user across all their API keys.

import { supabaseAdmin } from '@/lib/supabase';

export type AccessState =
    | 'no_key'              // user has registered but never created an API key
    | 'pending_payment'     // key exists, no subscription, no trial requested
    | 'trial_requested'     // user requested free trial — waiting for admin approval
    | 'trial_rejected'      // admin denied the trial request
    | 'trial_active'        // free trial running
    | 'trial_expired'       // free trial finished without conversion
    | 'active'              // paid subscription
    | 'past_due'            // paid but payment failed
    | 'canceled';           // subscription canceled

export interface BillingStatus {
    accessState: AccessState;
    hasAccess: boolean;
    plan: string;
    subscriptionStatus: string;
    trialEndsAt: string | null;
    trialRequestedAt: string | null;
    trialApprovedAt: string | null;
    trialRejectedAt: string | null;
    primaryKeyId: string | null;
    isAdmin?: boolean;
    email?: string | null;
}

const ACCESS_STATES: ReadonlySet<AccessState> = new Set(['trial_active', 'active']);

export async function getBillingStatus(userId: string): Promise<BillingStatus> {
    const { data: keys } = await supabaseAdmin
        .from('ts_api_keys')
        .select('id, plan, subscription_status, trial_ends_at, trial_requested_at, trial_approved_at, trial_rejected_at, created_at')
        .eq('owner_id', userId)
        .order('created_at', { ascending: true });

    if (!keys || keys.length === 0) {
        return {
            accessState: 'no_key',
            hasAccess: false,
            plan: 'none',
            subscriptionStatus: 'none',
            trialEndsAt: null,
            trialRequestedAt: null,
            trialApprovedAt: null,
            trialRejectedAt: null,
            primaryKeyId: null,
        };
    }

    // Pick the "best" key — the one with the strongest access tier.
    const ranked = [...keys].sort((a, b) => rank(a) - rank(b));
    const primary = ranked[0];
    const accessState = deriveAccessState(primary);

    return {
        accessState,
        hasAccess: ACCESS_STATES.has(accessState),
        plan: primary.plan || 'pending',
        subscriptionStatus: primary.subscription_status || 'pending',
        trialEndsAt: primary.trial_ends_at,
        trialRequestedAt: primary.trial_requested_at,
        trialApprovedAt: primary.trial_approved_at,
        trialRejectedAt: primary.trial_rejected_at,
        primaryKeyId: primary.id,
    };
}

function rank(k: any): number {
    // Lower = better access. Used to sort keys so primary = strongest.
    if (k.subscription_status === 'active') return 0;
    if (k.subscription_status === 'trialing') return 1;
    if (k.plan === 'free_trial' && k.trial_ends_at && new Date(k.trial_ends_at) > new Date()) return 2;
    if (k.subscription_status === 'past_due') return 3;
    if (k.trial_requested_at && !k.trial_approved_at && !k.trial_rejected_at) return 4;
    if (k.trial_rejected_at) return 5;
    if (k.subscription_status === 'canceled') return 6;
    return 7; // pending
}

function deriveAccessState(k: any): AccessState {
    const status = k.subscription_status || 'pending';
    const plan = k.plan || 'pending';

    if (status === 'active' && plan !== 'free_trial' && plan !== 'pending') return 'active';
    if (status === 'past_due') return 'past_due';
    if (status === 'canceled') return 'canceled';

    if (plan === 'free_trial') {
        const trialEnd = k.trial_ends_at ? new Date(k.trial_ends_at) : null;
        if (trialEnd && trialEnd > new Date()) return 'trial_active';
        return 'trial_expired';
    }

    if (k.trial_rejected_at) return 'trial_rejected';
    if (k.trial_requested_at && !k.trial_approved_at) return 'trial_requested';

    return 'pending_payment';
}

export async function requireSession(authHeader: string | null): Promise<
    { ok: true; userId: string; email: string | null } | { ok: false; status: number; error: string }
> {
    if (!authHeader?.startsWith('Bearer ')) {
        return { ok: false, status: 401, error: 'Authentication required' };
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
        return { ok: false, status: 401, error: 'Invalid session' };
    }
    return { ok: true, userId: user.id, email: user.email || null };
}
