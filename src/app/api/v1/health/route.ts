// TrialShield — Health Check Endpoint

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getDisposableDomainCount } from '@/data/disposable-domains';

export async function GET() {
    const startTime = Date.now();

    let dbStatus = 'unknown';
    try {
        const { error } = await supabaseAdmin.from('ts_api_keys').select('id').limit(1);
        dbStatus = error ? 'error' : 'connected';
    } catch {
        dbStatus = 'error';
    }

    return NextResponse.json({
        status: 'operational',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: dbStatus,
        modules: {
            emailIntelligence: true,
            phoneIntelligence: true,
            ipIntelligence: true,
            deviceFingerprint: true,
            behavioralAnalysis: true,
            graphAnalysis: true,
            riskScoring: true,
            adaptiveChallenges: true,
            postSignupMonitoring: true,
            compliance: true,
        },
        disposableDomains: getDisposableDomainCount(),
        env: {
            supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            supabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            masterKey: !!process.env.TRIALSHIELD_MASTER_KEY,
            haveibeenpwned: !!process.env.HIBP_API_KEY,
            abuseipdb: !!process.env.ABUSEIPDB_API_KEY,
            ipapi: !!process.env.IP_API_KEY,
        },
        latency: `${Date.now() - startTime}ms`,
    });
}
