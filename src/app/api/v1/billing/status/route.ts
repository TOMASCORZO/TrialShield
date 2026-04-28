// TrialShield — Billing status for the authenticated dashboard user.
// Used by the dashboard paywall to decide what to render.

import { NextRequest, NextResponse } from 'next/server';
import { getBillingStatus, requireSession } from '@/lib/billing-status';
import { isAdminEmail } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
    const session = await requireSession(request.headers.get('Authorization'));
    if (!session.ok) {
        return NextResponse.json({ error: session.error }, { status: session.status });
    }

    try {
        const status = await getBillingStatus(session.userId);
        return NextResponse.json({
            ...status,
            isAdmin: isAdminEmail(session.email),
            email: session.email,
        });
    } catch (error) {
        console.error('[TrialShield] billing/status error:', error);
        return NextResponse.json({ error: 'Failed to load billing status' }, { status: 500 });
    }
}
