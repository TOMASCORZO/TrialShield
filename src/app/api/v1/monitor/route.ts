// TrialShield — Post-Signup Monitor Endpoint

import { NextRequest, NextResponse } from 'next/server';
import { trackEvent } from '@/services/post-signup-monitor';
import { MonitorEvent } from '@/types';

export async function POST(request: NextRequest) {
    try {
        const body: MonitorEvent = await request.json();

        if (!body.userId || !body.eventType) {
            return NextResponse.json({
                error: 'userId and eventType are required',
            }, { status: 400 });
        }

        const result = await trackEvent({
            userId: body.userId,
            eventType: body.eventType,
            metadata: body.metadata,
            timestamp: new Date().toISOString(),
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('[TrialShield] Monitor endpoint error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
