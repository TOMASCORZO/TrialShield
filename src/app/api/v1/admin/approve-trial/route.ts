// TrialShield — Admin: approve a trial request.
// POST /api/v1/admin/approve-trial
//   Header: X-Admin-Key: <TRIALSHIELD_MASTER_KEY>
//   Body:   { apiKeyId: string, durationDays?: number }
// Activates the API key on the free_trial plan for `durationDays` (default 14).

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/admin-auth';
import { notifyUserTrialApproved } from '@/lib/email';

const DEFAULT_TRIAL_DAYS = 14;
const MAX_TRIAL_DAYS = 90;

export async function POST(request: NextRequest) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    try {
        const body = await request.json().catch(() => ({}));
        const apiKeyId = body?.apiKeyId;
        const requestedDays = Number(body?.durationDays) || DEFAULT_TRIAL_DAYS;
        const durationDays = Math.max(1, Math.min(MAX_TRIAL_DAYS, requestedDays));

        if (!apiKeyId || typeof apiKeyId !== 'string') {
            return NextResponse.json({ error: 'apiKeyId is required' }, { status: 400 });
        }

        const trialEndsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
        const now = new Date().toISOString();

        const { data, error } = await supabaseAdmin
            .from('ts_api_keys')
            .update({
                plan: 'free_trial',
                subscription_status: 'trialing',
                trial_ends_at: trialEndsAt,
                trial_approved_at: now,
                trial_rejected_at: null,
            })
            .eq('id', apiKeyId)
            .select('id, owner_id, trial_ends_at')
            .single();

        if (error || !data) {
            return NextResponse.json({ error: 'API key not found' }, { status: 404 });
        }

        // Notify the user (fire-and-forget)
        if (data.owner_id) {
            const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(data.owner_id);
            if (user?.email) {
                notifyUserTrialApproved({
                    to: user.email,
                    durationDays,
                    trialEndsAt: data.trial_ends_at,
                }).catch(() => { /* logged inside email helper */ });
            }
        }

        return NextResponse.json({ success: true, apiKeyId: data.id, trialEndsAt: data.trial_ends_at });
    } catch (error) {
        console.error('[TrialShield] admin approve-trial error:', error);
        return NextResponse.json({ error: 'Failed to approve trial' }, { status: 500 });
    }
}
