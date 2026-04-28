'use client';

// Onboarding + trial state widget that sits at the top of /dashboard.
// - Shows a big welcome with a 4-step checklist when the trial was just approved.
// - Falls back to a compact countdown for ongoing trials.
// - Hidden entirely once the user is on a paid plan.
//
// Uses /api/v1/billing/status, no extra endpoints needed.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { BillingStatus } from '@/lib/billing-status';

const DISMISS_KEY = 'ts_onboarding_dismissed_v1';
const RECENT_APPROVAL_DAYS = 7;

export default function OnboardingBanner() {
    const [billing, setBilling] = useState<BillingStatus | null>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
        }

        let cancelled = false;
        async function load() {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            try {
                const res = await fetch('/api/v1/billing/status', {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });
                if (!res.ok) return;
                const data: BillingStatus = await res.json();
                if (!cancelled) setBilling(data);
            } catch { /* swallow */ }
        }
        load();
        return () => { cancelled = true; };
    }, []);

    function dismiss() {
        localStorage.setItem(DISMISS_KEY, '1');
        setDismissed(true);
    }

    if (!billing) return null;

    const trialDaysLeft = billing.trialEndsAt
        ? Math.max(0, Math.ceil((new Date(billing.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;

    const recentlyApproved = billing.trialApprovedAt
        ? Date.now() - new Date(billing.trialApprovedAt).getTime() < RECENT_APPROVAL_DAYS * 24 * 60 * 60 * 1000
        : false;

    const showWelcome = billing.accessState === 'trial_active' && recentlyApproved && !dismissed;
    const showCountdown = billing.accessState === 'trial_active' && !showWelcome;
    const showUrgentExpiring = billing.accessState === 'trial_active' && trialDaysLeft !== null && trialDaysLeft <= 3;

    if (showWelcome) {
        return (
            <div className="glass-card animate-fade-in" style={{
                padding: '28px',
                marginBottom: '32px',
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent-line)',
                position: 'relative',
            }}>
                <button
                    onClick={dismiss}
                    style={{
                        position: 'absolute', top: '12px', right: '12px',
                        background: 'transparent', border: 'none',
                        color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px',
                        padding: '4px 8px', borderRadius: '6px',
                    }}
                    aria-label="Dismiss"
                >
                    ✕
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '32px' }}>🎉</span>
                    <h2 style={{ fontSize: '22px', margin: 0 }}>Your free trial is active!</h2>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px', maxWidth: '640px' }}>
                    You have <strong>{trialDaysLeft ?? '—'} days</strong> of full access to TrialShield. Here&apos;s how to get your first verification running in under 5 minutes.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                    <OnboardingStep
                        n={1}
                        title="Copy your API key"
                        description="Find it under Settings."
                        href="/dashboard/settings"
                        cta="Get key →"
                    />
                    <OnboardingStep
                        n={2}
                        title="Read the docs"
                        description="See the verify endpoint."
                        href="/docs"
                        cta="View docs →"
                    />
                    <OnboardingStep
                        n={3}
                        title="Run a test request"
                        description="Try the API with sample data."
                        href="/dashboard/test"
                        cta="Test API →"
                    />
                    <OnboardingStep
                        n={4}
                        title="Watch results stream in"
                        description="Events show up here in real time."
                        href="/dashboard/events"
                        cta="See events →"
                    />
                </div>
            </div>
        );
    }

    if (showCountdown) {
        const styles = showUrgentExpiring
            ? {
                background: 'var(--red-soft)',
                border: '1px solid var(--red-line)',
                color: 'var(--red)',
            }
            : {
                background: 'var(--bg-elev)',
                border: '1px solid var(--line)',
                color: 'var(--ink-2)',
            };

        return (
            <div className="glass-card" style={{
                padding: '14px 20px', marginBottom: '24px',
                ...styles,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
                flexWrap: 'wrap',
            }}>
                <div style={{ fontSize: '14px' }}>
                    {showUrgentExpiring ? '⚠️ ' : '⏳ '}
                    <strong>{trialDaysLeft}</strong> day{trialDaysLeft === 1 ? '' : 's'} left in your free trial.
                    {showUrgentExpiring && ' Subscribe now to avoid losing access.'}
                </div>
                <a href="/dashboard/billing" className={`btn btn-sm ${showUrgentExpiring ? 'btn-danger' : 'btn-primary'}`}>
                    {showUrgentExpiring ? 'Subscribe now' : 'View plans'}
                </a>
            </div>
        );
    }

    return null;
}

function OnboardingStep({ n, title, description, href, cta }: {
    n: number; title: string; description: string; href: string; cta: string;
}) {
    return (
        <a href={href} style={{
            display: 'block', padding: '16px',
            background: 'var(--bg-elev)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--line)',
            textDecoration: 'none', color: 'var(--ink)',
            transition: 'border-color 120ms ease, box-shadow 120ms ease',
        }}>
            <div style={{
                width: '22px', height: '22px', borderRadius: '50%',
                background: 'var(--ink)', color: '#fff',
                fontSize: '11px', fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '12px',
            }}>{n}</div>
            <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px', letterSpacing: '-0.01em' }}>{title}</div>
            <div style={{ fontSize: '12px', color: 'var(--ink-3)', marginBottom: '10px' }}>{description}</div>
            <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 500 }}>{cta}</div>
        </a>
    );
}
