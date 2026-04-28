// TrialShield — Admin: reject a trial request.
// POST /api/v1/admin/reject-trial
//   Header: X-Admin-Key: <TRIALSHIELD_MASTER_KEY>
//   Body:   { apiKeyId: string }

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/admin-auth';
import { notifyUserTrialRejected } from '@/lib/email';

export async function POST(request: NextRequest) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    try {
        const body = await request.json().catch(() => ({}));
        const apiKeyId = body?.apiKeyId;

        if (!apiKeyId || typeof apiKeyId !== 'string') {
            return NextResponse.json({ error: 'apiKeyId is required' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('ts_api_keys')
            .update({
                trial_rejected_at: new Date().toISOString(),
                trial_approved_at: null,
            })
            .eq('id', apiKeyId)
            .select('id, owner_id')
            .single();

        if (error || !data) {
            return NextResponse.json({ error: 'API key not found' }, { status: 404 });
        }

        // Notify the user (fire-and-forget)
        if (data.owner_id) {
            const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(data.owner_id);
            if (user?.email) {
                notifyUserTrialRejected({ to: user.email })
                    .catch(() => { /* logged inside email helper */ });
            }
        }

        return NextResponse.json({ success: true, apiKeyId: data.id });
    } catch (error) {
        console.error('[TrialShield] admin reject-trial error:', error);
        return NextResponse.json({ error: 'Failed to reject trial' }, { status: 500 });
    }
}
