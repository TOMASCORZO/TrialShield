// TrialShield — Free trial request
// POST /api/v1/billing/trial-request
//   - Auto-creates the user's first API key in 'pending' state if they don't have one.
//   - Stamps trial_requested_at so an admin can review and approve.
// Idempotent: if a trial is already requested or active, returns the current state.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateApiKey, hashApiKey } from '@/lib/utils';
import { getBillingStatus, requireSession } from '@/lib/billing-status';
import { notifyAdminOfTrialRequest } from '@/lib/email';

const MAX_NOTE_LENGTH = 500;

export async function POST(request: NextRequest) {
    const session = await requireSession(request.headers.get('Authorization'));
    if (!session.ok) {
        return NextResponse.json({ error: session.error }, { status: session.status });
    }

    let note: string | null = null;
    try {
        const body = await request.json().catch(() => ({}));
        if (typeof body?.note === 'string') {
            note = body.note.slice(0, MAX_NOTE_LENGTH);
        }
    } catch { /* ignore body parsing errors */ }

    try {
        // Find or create the user's primary API key
        let { data: keys } = await supabaseAdmin
            .from('ts_api_keys')
            .select('id, plan, subscription_status, trial_requested_at, trial_approved_at, trial_rejected_at, trial_ends_at')
            .eq('owner_id', session.userId)
            .order('created_at', { ascending: true });

        let primaryKey = keys?.[0];

        if (!primaryKey) {
            const newKey = generateApiKey();
            const { data: created, error: createErr } = await supabaseAdmin
                .from('ts_api_keys')
                .insert({
                    name: 'Default',
                    hashed_key: hashApiKey(newKey),
                    owner_id: session.userId,
                    rate_limit: 30,
                    is_active: true,
                    plan: 'pending',
                    subscription_status: 'pending',
                })
                .select('id, plan, subscription_status, trial_requested_at, trial_approved_at, trial_rejected_at, trial_ends_at')
                .single();
            if (createErr || !created) {
                throw createErr || new Error('Failed to bootstrap API key');
            }
            primaryKey = created;
        }

        // If a trial is already approved/active or subscription is active, no-op.
        if (primaryKey.trial_approved_at || primaryKey.subscription_status === 'active') {
            const status = await getBillingStatus(session.userId);
            return NextResponse.json({ status, alreadyActive: true });
        }

        // Otherwise, mark as requested (resets a previous rejection so the user can re-apply once)
        const { error: updateErr } = await supabaseAdmin
            .from('ts_api_keys')
            .update({
                trial_requested_at: new Date().toISOString(),
                trial_rejected_at: null,
                trial_request_note: note,
            })
            .eq('id', primaryKey.id);

        if (updateErr) throw updateErr;

        // Fire-and-forget email so the admin can review fast
        notifyAdminOfTrialRequest({
            userEmail: session.email,
            userId: session.userId,
            note,
        }).catch(() => { /* logged inside email helper */ });

        const status = await getBillingStatus(session.userId);
        return NextResponse.json({ status, requested: true });
    } catch (error) {
        console.error('[TrialShield] trial-request error:', error);
        return NextResponse.json({ error: 'Failed to submit trial request' }, { status: 500 });
    }
}
