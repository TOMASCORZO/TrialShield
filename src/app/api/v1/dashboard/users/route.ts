import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
    try {
        // Fetch all users ordered by newest first
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
            .order('last_seen', { ascending: false })
            .limit(100);

        if (usersError) throw usersError;

        // Fetch the latest risk event for each user to get the rejection reason and relationship data
        const enrichedUsers = await Promise.all((users || []).map(async (user) => {
            const { data: latestEvent } = await supabaseAdmin
                .from('ts_risk_events')
                .select('decision, risk_score, signals, enrichment, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            let matchedUserId = null;
            let rejectionReasons: string[] = [];

            if (latestEvent) {
                // Check if there's a relationship found (matchedUserId usually placed in enrichment)
                if (latestEvent.enrichment && typeof latestEvent.enrichment === 'object' && 'matchedUserId' in latestEvent.enrichment) {
                    matchedUserId = (latestEvent.enrichment as any).matchedUserId;
                }
                
                // Extract signals if they were rejected
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
                rejectionReasons: rejectionReasons,
                latestEventDate: latestEvent?.created_at || user.last_seen
            };
        }));

        return NextResponse.json({ users: enrichedUsers });
    } catch (error) {
        console.error('[TrialShield] Dashboard Users API error:', error);
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}
