'use client';

// Gate every /admin/* page on Supabase session + ADMIN_EMAILS membership.
// Calls /api/v1/billing/status because it already returns isAdmin scoped to the JWT.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { BillingStatus } from '@/lib/billing-status';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [state, setState] = useState<'checking' | 'allowed' | 'denied'>('checking');
    const [email, setEmail] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function check() {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.replace('/login');
                return;
            }

            try {
                const res = await fetch('/api/v1/billing/status', {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });
                if (!res.ok) {
                    if (!cancelled) setState('denied');
                    return;
                }
                const data: BillingStatus = await res.json();
                if (cancelled) return;
                if (data.isAdmin) {
                    setEmail(data.email || null);
                    setState('allowed');
                } else {
                    setState('denied');
                }
            } catch {
                if (!cancelled) setState('denied');
            }
        }

        check();
        return () => { cancelled = true; };
    }, [router]);

    if (state === 'checking') {
        return (
            <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg-primary)', color: 'var(--text-muted)',
            }}>
                Loading...
            </div>
        );
    }

    if (state === 'denied') {
        return (
            <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '40px', background: 'var(--bg-primary)',
            }}>
                <div className="glass-card animate-fade-in" style={{ padding: '40px', maxWidth: '440px', textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔒</div>
                    <h1 style={{ fontSize: '22px', marginBottom: '8px' }}>Admin access only</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                        Your account is not in the operator allowlist. If you think this is a mistake, contact the team.
                    </p>
                    <a href="/dashboard" className="btn btn-primary">← Back to dashboard</a>
                </div>
            </div>
        );
    }

    return (
        <div data-admin-email={email || ''}>
            {children}
        </div>
    );
}
