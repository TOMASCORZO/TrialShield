// TrialShield — Dashboard Stats API

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hoursAgo } from '@/lib/utils';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.replace('Bearer ', '');
        
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            console.error('[Stats API] Auth error:', authError || 'No user found for token');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch API keys belonging to this developer
        const { data: keysData } = await supabaseAdmin
            .from('ts_api_keys')
            .select('id, hashed_key')
            .eq('owner_id', user.id);
            
        const keyIds = keysData?.map(k => k.id) || [];

        if (keyIds.length === 0) {
            // New user, no API keys yet
            return NextResponse.json({
                totalEvaluations: 0,
                evaluationsToday: 0,
                allowRate: 0, denyRate: 0, challengeRate: 0,
                avgRiskScore: 0,
                recentEvaluations: [],
                riskDistribution: [
                    { range: '0-20', count: 0 },
                    { range: '20-40', count: 0 },
                    { range: '40-60', count: 0 },
                    { range: '60-80', count: 0 },
                    { range: '80-100', count: 0 },
                ],
                allowCount: 0, denyCount: 0, challengeCount: 0,
            });
        }

        // Total evaluations
        const { count: totalEvaluations } = await supabaseAdmin
            .from('ts_risk_events')
            .select('*', { count: 'exact', head: true })
            .in('api_key_id', keyIds);

        // Today's evaluations
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { count: evaluationsToday } = await supabaseAdmin
            .from('ts_risk_events')
            .select('*', { count: 'exact', head: true })
            .in('api_key_id', keyIds)
            .gte('created_at', todayStart.toISOString());

        // Decision distribution
        const { count: allowCount } = await supabaseAdmin
            .from('ts_risk_events')
            .select('*', { count: 'exact', head: true })
            .in('api_key_id', keyIds)
            .eq('decision', 'ALLOW');

        const { count: denyCount } = await supabaseAdmin
            .from('ts_risk_events')
            .select('*', { count: 'exact', head: true })
            .in('api_key_id', keyIds)
            .eq('decision', 'DENY');

        const { count: challengeCount } = await supabaseAdmin
            .from('ts_risk_events')
            .select('*', { count: 'exact', head: true })
            .in('api_key_id', keyIds)
            .eq('decision', 'CHALLENGE');

        const total = (totalEvaluations || 1);

        // Recent evaluations
        const { data: recentEvals } = await supabaseAdmin
            .from('ts_risk_events')
            .select('id, decision, risk_score, email_score, phone_score, ip_score, device_score, behavior_score, graph_score, signals, processing_time_ms, created_at')
            .in('api_key_id', keyIds)
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

        let totalScoreSum = 0;
        let scoreCount = 0;

        if (recentEvals) {
            for (const ev of recentEvals) {
                const score = ev.risk_score;
                totalScoreSum += score;
                scoreCount++;
                if (score <= 20) riskDistribution[0].count++;
                else if (score <= 40) riskDistribution[1].count++;
                else if (score <= 60) riskDistribution[2].count++;
                else if (score <= 80) riskDistribution[3].count++;
                else riskDistribution[4].count++;
            }
        }
        
        // Manual average calculation for specific tenant since avg_risk_score rpc was global
        const avgRiskScore = scoreCount > 0 ? Math.round(totalScoreSum / scoreCount) : 0;

        return NextResponse.json({
            totalEvaluations: totalEvaluations || 0,
            evaluationsToday: evaluationsToday || 0,
            allowRate: Math.round(((allowCount || 0) / total) * 100),
            denyRate: Math.round(((denyCount || 0) / total) * 100),
            challengeRate: Math.round(((challengeCount || 0) / total) * 100),
            avgRiskScore: avgRiskScore,
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
