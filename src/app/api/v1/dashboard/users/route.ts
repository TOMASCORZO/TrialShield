// TrialShield — Dashboard Users API
// Returns end-users that were evaluated through the authenticated dashboard user's API keys.
// Multi-tenant isolation: a dashboard user can only see users tied to their own keys.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: dashUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !dashUser) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    try {
        // 1. Get all API keys owned by this dashboard user
        const { data: keysData } = await supabaseAdmin
            .from('ts_api_keys')
            .select('id')
            .eq('owner_id', dashUser.id);

        const keyIds = (keysData || []).map(k => k.id);
        if (keyIds.length === 0) {
            return NextResponse.json({ users: [] });
        }

        // 2. Find distinct end-user IDs from risk events tied to these keys
        const { data: eventUsers } = await supabaseAdmin
            .from('ts_risk_events')
            .select('user_id')
            .in('api_key_id', keyIds)
            .not('user_id', 'is', null);

        const endUserIds = Array.from(new Set((eventUsers || []).map(e => e.user_id).filter(Boolean)));
        if (endUserIds.length === 0) {
            return NextResponse.json({ users: [] });
        }

        // 3. Fetch only those end-users
        const { data: users, error: usersError } = await supabaseAdmin
            .from('ts_users')
            .select(`
                id,
                email_hash,
                first_seen,
                last_seen,
                total_evaluations,
                highest_risk_score,
                last_decision,
                is_quarantined
            `)
            .in('id', endUserIds)
            .order('last_seen', { ascending: false })
            .limit(100);

        if (usersError) throw usersError;

        // 4. Enrich with the latest risk event (scoped to this owner's keys)
        const enrichedUsers = await Promise.all((users || []).map(async (user) => {
            const { data: latestEvent } = await supabaseAdmin
                .from('ts_risk_events')
                .select('decision, risk_score, signals, enrichment, created_at')
                .eq('user_id', user.id)
                .in('api_key_id', keyIds)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            let matchedUserId = null;
            let rejectionReasons: string[] = [];

            if (latestEvent) {
                if (latestEvent.enrichment && typeof latestEvent.enrichment === 'object' && 'matchedUserId' in latestEvent.enrichment) {
                    matchedUserId = (latestEvent.enrichment as any).matchedUserId;
                }
                if (latestEvent.decision === 'DENY' || latestEvent.decision === 'REVOKE') {
                    if (Array.isArray(latestEvent.signals)) {
                        rejectionReasons = latestEvent.signals
                            .filter((s: any) => s.severity === 'CRITICAL' || s.severity === 'HIGH')
                            .map((s: any) => s.description || s.signal);
                    }
                }
            }

            return {
                ...user,
                infractionPercentage: latestEvent?.risk_score || user.highest_risk_score,
                relationshipFound: !!matchedUserId,
                matchedUser: matchedUserId,
                rejectionReasons,
                latestEventDate: latestEvent?.created_at || user.last_seen,
            };
        }));

        return NextResponse.json({ users: enrichedUsers });
    } catch (error) {
        console.error('[TrialShield] Dashboard Users API error:', error);
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}
