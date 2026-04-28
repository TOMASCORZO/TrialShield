// TrialShield — Admin: list pending trial requests.
// GET /api/v1/admin/list-trial-requests
//   Header: X-Admin-Key: <TRIALSHIELD_MASTER_KEY>
//   Returns API keys with trial_requested_at set and not yet approved/rejected.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    try {
        const { data: keys, error } = await supabaseAdmin
            .from('ts_api_keys')
            .select('id, name, owner_id, trial_requested_at, trial_request_note, plan, subscription_status, created_at')
            .not('trial_requested_at', 'is', null)
            .is('trial_approved_at', null)
            .is('trial_rejected_at', null)
            .order('trial_requested_at', { ascending: true });

        if (error) throw error;

        // Enrich with owner email so the operator knows who is asking.
        const ownerIds = Array.from(new Set((keys || []).map(k => k.owner_id).filter(Boolean)));
        const emailById = new Map<string, string>();

        for (const ownerId of ownerIds) {
            const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(ownerId);
            if (user?.email) emailById.set(ownerId, user.email);
        }

        const enriched = (keys || []).map(k => ({
            ...k,
            owner_email: k.owner_id ? emailById.get(k.owner_id) || null : null,
        }));

        return NextResponse.json({ requests: enriched });
    } catch (error) {
        console.error('[TrialShield] admin list-trial-requests error:', error);
        return NextResponse.json({ error: 'Failed to list trial requests' }, { status: 500 });
    }
}
