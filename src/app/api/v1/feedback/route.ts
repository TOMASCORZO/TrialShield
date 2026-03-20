// TrialShield — Feedback Endpoint

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.evaluationId || body.isAbuser === undefined) {
            return NextResponse.json({
                error: 'evaluationId and isAbuser are required',
            }, { status: 400 });
        }

        await supabaseAdmin.from('ts_feedback').insert({
            evaluation_id: body.evaluationId,
            is_abuser: body.isAbuser,
            notes: body.notes || null,
        });

        return NextResponse.json({
            success: true,
            message: 'Feedback recorded. This will improve future risk scoring.',
        });
    } catch (error) {
        console.error('[TrialShield] Feedback error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
