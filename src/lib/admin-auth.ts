// TrialShield — Auth gate for admin endpoints.
// Two acceptable credentials:
//   1. X-Admin-Key header set to TRIALSHIELD_MASTER_KEY (for cron + curl)
//   2. Supabase JWT whose user.email is listed in ADMIN_EMAILS (for the dashboard UI)
//
// ADMIN_EMAILS is a comma-separated list, e.g. "founder@yourco.com,ops@yourco.com".

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export type AdminAuth = { ok: true; via: 'master_key' | 'jwt'; email?: string }
    | { ok: false; status: number; error: string };

function getAdminEmails(): Set<string> {
    const raw = process.env.ADMIN_EMAILS || '';
    return new Set(
        raw.split(',')
            .map(e => e.trim().toLowerCase())
            .filter(Boolean)
    );
}

export function isAdminEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    return getAdminEmails().has(email.toLowerCase());
}

// Synchronous master-key check (used by cron / server-to-server callers).
export function requireMasterKey(request: NextRequest): AdminAuth {
    const masterKey = process.env.TRIALSHIELD_MASTER_KEY;
    if (!masterKey) {
        return { ok: false, status: 503, error: 'Admin endpoints disabled: TRIALSHIELD_MASTER_KEY is not configured' };
    }
    const provided = request.headers.get('X-Admin-Key') || '';
    if (provided !== masterKey) {
        return { ok: false, status: 401, error: 'Admin authentication required' };
    }
    return { ok: true, via: 'master_key' };
}

// Accepts either the master key OR a Supabase JWT belonging to an admin email.
export async function requireAdmin(request: NextRequest): Promise<AdminAuth> {
    const masterKey = process.env.TRIALSHIELD_MASTER_KEY;
    const adminKeyHeader = request.headers.get('X-Admin-Key');
    if (masterKey && adminKeyHeader && adminKeyHeader === masterKey) {
        return { ok: true, via: 'master_key' };
    }

    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        if (user?.email && isAdminEmail(user.email)) {
            return { ok: true, via: 'jwt', email: user.email };
        }
    }

    return { ok: false, status: 401, error: 'Admin authentication required' };
}
