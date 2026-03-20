// TrialShield — User Management & GDPR Delete Endpoint

import { NextRequest, NextResponse } from 'next/server';
import { handleDeleteRequest, exportUserData } from '@/services/compliance';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const url = new URL(request.url);
        const type = (url.searchParams.get('type') || 'email') as 'email' | 'phone';

        const data = await exportUserData(id, type);
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
    }
}

// DELETE - GDPR/CCPA Data Deletion
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const url = new URL(request.url);
        const type = (url.searchParams.get('type') || 'user_id') as 'email' | 'phone' | 'user_id';

        const result = await handleDeleteRequest(id, type);

        if (result.success) {
            return NextResponse.json(result);
        }
        return NextResponse.json(result, { status: 500 });
    } catch (error) {
        return NextResponse.json({ error: 'Delete request failed' }, { status: 500 });
    }
}
