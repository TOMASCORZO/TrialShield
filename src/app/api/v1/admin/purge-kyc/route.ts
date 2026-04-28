// TrialShield — Admin: purge raw KYC images past retention.
// POST /api/v1/admin/purge-kyc
//   Header: X-Admin-Key: <TRIALSHIELD_MASTER_KEY>
//   Body:   { olderThanDays?: number }   default: 30
//
// Strategy: nullify `selfie_data` and `document_front_data` for sessions completed
// more than `olderThanDays` days ago. Hashes (selfie_hash, document_front_hash) and
// risk results stay so we can still detect document/selfie reuse across tenants.
//
// Recommended cron (Vercel cron or pg_cron) — daily at 03:00 UTC.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireMasterKey } from '@/lib/admin-auth';
import { logInfo, logError } from '@/lib/logger';

const DEFAULT_RETENTION_DAYS = 30;
const MAX_BATCH = 500;

export async function POST(request: NextRequest) {
    const auth = requireMasterKey(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    try {
        const body = await request.json().catch(() => ({}));
        const days = Math.max(1, Math.min(3650, Number(body?.olderThanDays) || DEFAULT_RETENTION_DAYS));
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        const { data: candidates, error: selectErr } = await supabaseAdmin
            .from('ts_kyc_sessions')
            .select('id')
            .is('purged_at', null)
            .not('completed_at', 'is', null)
            .lte('completed_at', cutoff)
            .limit(MAX_BATCH);

        if (selectErr) throw selectErr;

        if (!candidates || candidates.length === 0) {
            return NextResponse.json({ purged: 0, retentionDays: days });
        }

        const ids = candidates.map(c => c.id);
        const { error: updateErr } = await supabaseAdmin
            .from('ts_kyc_sessions')
            .update({
                selfie_data: null,
                document_front_data: null,
                purged_at: new Date().toISOString(),
            })
            .in('id', ids);

        if (updateErr) throw updateErr;

        logInfo('kyc.purge', { purged: ids.length, retentionDays: days });
        return NextResponse.json({ purged: ids.length, retentionDays: days });
    } catch (error) {
        logError('kyc.purge_failed', error);
        return NextResponse.json({ error: 'Failed to purge KYC data' }, { status: 500 });
    }
}
