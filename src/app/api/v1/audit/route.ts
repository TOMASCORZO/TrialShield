// TrialShield — Audit Logs & User Management Endpoint

import { NextRequest, NextResponse } from 'next/server';
import { getAuditLogs } from '@/services/compliance';

export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const apiKeyId = url.searchParams.get('apiKeyId') || undefined;
        const startDate = url.searchParams.get('startDate') || undefined;
        const endDate = url.searchParams.get('endDate') || undefined;

        const result = await getAuditLogs({ limit, offset, apiKeyId, startDate, endDate });

        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
    }
}
