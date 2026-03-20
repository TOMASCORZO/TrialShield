// TrialShield — Dashboard Stats API

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hoursAgo } from '@/lib/utils';

export async function GET() {
    try {
        // Total evaluations
        const { count: totalEvaluations } = await supabaseAdmin
            .from('ts_risk_events')
            .select('*', { count: 'exact', head: true });

        // Today's evaluations
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { count: evaluationsToday } = await supabaseAdmin
            .from('ts_risk_events')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', todayStart.toISOString());

        // Decision distribution
        const { count: allowCount } = await supabaseAdmin
            .from('ts_risk_events')
            .select('*', { count: 'exact', head: true })
            .eq('decision', 'ALLOW');

        const { count: denyCount } = await supabaseAdmin
            .from('ts_risk_events')
            .select('*', { count: 'exact', head: true })
            .eq('decision', 'DENY');

        const { count: challengeCount } = await supabaseAdmin
            .from('ts_risk_events')
            .select('*', { count: 'exact', head: true })
            .eq('decision', 'CHALLENGE');

        const total = (totalEvaluations || 1);

        // Average risk score
        const { data: avgData } = await supabaseAdmin
            .rpc('avg_risk_score')
            .single() as { data: Record<string, number> | null };

        // Recent evaluations
        const { data: recentEvals } = await supabaseAdmin
            .from('ts_risk_events')
            .select('id, decision, risk_score, email_score, phone_score, ip_score, device_score, behavior_score, graph_score, signals, processing_time_ms, created_at')
            .order('created_at', { ascending: false })
            .limit(20);

        // Risk distribution (0-20, 20-40, 40-60, 60-80, 80-100)
        const riskDistribution = [
            { range: '0-20', count: 0 },
            { range: '20-40', count: 0 },
            { range: '40-60', count: 0 },
            { range: '60-80', count: 0 },
            { range: '80-100', count: 0 },
        ];

        if (recentEvals) {
            for (const ev of recentEvals) {
                const score = ev.risk_score;
                if (score <= 20) riskDistribution[0].count++;
                else if (score <= 40) riskDistribution[1].count++;
                else if (score <= 60) riskDistribution[2].count++;
                else if (score <= 80) riskDistribution[3].count++;
                else riskDistribution[4].count++;
            }
        }

        return NextResponse.json({
            totalEvaluations: totalEvaluations || 0,
            evaluationsToday: evaluationsToday || 0,
            allowRate: Math.round(((allowCount || 0) / total) * 100),
            denyRate: Math.round(((denyCount || 0) / total) * 100),
            challengeRate: Math.round(((challengeCount || 0) / total) * 100),
            avgRiskScore: avgData?.avg || 0,
            recentEvaluations: recentEvals || [],
            riskDistribution,
            allowCount: allowCount || 0,
            denyCount: denyCount || 0,
            challengeCount: challengeCount || 0,
        });
    } catch (error) {
        console.error('[TrialShield] Stats error:', error);
        return NextResponse.json({
            totalEvaluations: 0,
            evaluationsToday: 0,
            allowRate: 0, denyRate: 0, challengeRate: 0,
            avgRiskScore: 0,
            recentEvaluations: [],
            riskDistribution: [],
            allowCount: 0, denyCount: 0, challengeCount: 0,
        });
    }
}
