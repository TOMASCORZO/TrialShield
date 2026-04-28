'use client';

// Paywall: every dashboard page is hidden behind this gate except /dashboard/billing.
// If the user has no active subscription / approved trial, they are redirected to
// /dashboard/billing where they can subscribe or request a free trial.

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { BillingStatus } from '@/lib/billing-status';

const ALLOWED_PATHS = ['/dashboard/billing'];

export default function SubscriptionGate({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [checked, setChecked] = useState(false);
    const [hasAccess, setHasAccess] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function check() {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return; // AuthGuard will redirect to /login

            try {
                const res = await fetch('/api/v1/billing/status', {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });
                if (!res.ok) {
                    if (!cancelled) {
                        setHasAccess(false);
                        setChecked(true);
                    }
                    return;
                }
                const status: BillingStatus = await res.json();
                if (cancelled) return;

                setHasAccess(status.hasAccess);
                setChecked(true);

                if (!status.hasAccess && !ALLOWED_PATHS.includes(pathname || '')) {
                    router.replace('/dashboard/billing');
                }
            } catch {
                if (!cancelled) {
                    setHasAccess(false);
                    setChecked(true);
                }
            }
        }

        check();
        return () => { cancelled = true; };
    }, [pathname, router]);

    // While the check is running, render nothing on gated pages to avoid flashing
    // sensitive UI before the redirect resolves. The billing page is always allowed.
    const isAllowedPath = ALLOWED_PATHS.includes(pathname || '');
    if (!checked && !isAllowedPath) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
                Loading...
            </div>
        );
    }

    if (!hasAccess && !isAllowedPath) {
        // Redirect is in flight; render nothing.
        return null;
    }

    return <>{children}</>;
}
