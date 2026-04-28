'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { BillingStatus, AccessState } from '@/lib/billing-status';

const PLANS = [
    {
        id: 'starter',
        name: 'Starter',
        price: '$29/mo',
        priceYearly: '$290/yr',
        color: '#6366f1',
        features: [
            '5,000 users/mo',
            '120 req/min',
            'Verify + Track + Monitor',
            'OAuth providers',
            'Stripe integration',
            'Email support',
        ],
    },
    {
        id: 'pro',
        name: 'Pro',
        price: '$99/mo',
        priceYearly: '$990/yr',
        color: '#8b5cf6',
        popular: true,
        features: [
            '50,000 users/mo',
            '600 req/min',
            'Everything in Starter',
            'Graph analysis',
            'Compliance module',
            'Duplicate user engine',
            'Priority support',
        ],
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        price: 'Custom',
        priceYearly: 'Custom',
        color: '#ec4899',
        features: [
            'Unlimited users',
            '3,000 req/min',
            'Everything in Pro',
            'Dedicated infrastructure',
            'Custom rules engine',
            'SLA guarantee',
            'Slack + webhook support',
        ],
    },
];

interface BannerCopy {
    title: string;
    body: string;
    tone: 'success' | 'warning' | 'danger' | 'info';
}

function bannerForState(state: AccessState, daysLeft: number | null): BannerCopy {
    switch (state) {
        case 'no_key':
            return {
                title: 'Welcome to TrialShield',
                body: 'Pick a plan or request a free trial below to activate your account.',
                tone: 'info',
            };
        case 'pending_payment':
            return {
                title: 'Activation required',
                body: 'Your dashboard and API are locked until you subscribe or get a free trial approved.',
                tone: 'danger',
            };
        case 'trial_requested':
            return {
                title: 'Trial request received',
                body: 'Our team is reviewing your free trial request. You will get access as soon as it is approved.',
                tone: 'warning',
            };
        case 'trial_rejected':
            return {
                title: 'Trial request denied',
                body: 'Your free trial request was not approved. You can still subscribe to a paid plan to get instant access.',
                tone: 'danger',
            };
        case 'trial_active':
            return {
                title: daysLeft !== null && daysLeft <= 3
                    ? `Trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
                    : 'Free trial active',
                body: 'Subscribe before your trial ends to keep using TrialShield without interruption.',
                tone: daysLeft !== null && daysLeft <= 3 ? 'warning' : 'success',
            };
        case 'trial_expired':
            return {
                title: 'Trial expired',
                body: 'Your free trial has ended. Subscribe to restore access to the dashboard and API.',
                tone: 'danger',
            };
        case 'active':
            return {
                title: 'Subscription active',
                body: 'You have full access to the dashboard and API.',
                tone: 'success',
            };
        case 'past_due':
            return {
                title: 'Payment failed',
                body: 'We could not process your last payment. Update your payment method to keep your access.',
                tone: 'danger',
            };
        case 'canceled':
            return {
                title: 'Subscription canceled',
                body: 'Resubscribe at any time to restore access.',
                tone: 'warning',
            };
    }
}

function toneStyles(tone: BannerCopy['tone']) {
    switch (tone) {
        case 'success':
            return {
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06), rgba(16, 185, 129, 0.02))',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                badgeColor: 'var(--color-allow)',
            };
        case 'warning':
            return {
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.06), rgba(245, 158, 11, 0.02))',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                badgeColor: 'var(--color-challenge)',
            };
        case 'danger':
            return {
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.06), rgba(239, 68, 68, 0.02))',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                badgeColor: 'var(--color-deny)',
            };
        case 'info':
            return {
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.06), rgba(168, 85, 247, 0.06))',
                border: '1px solid rgba(99, 102, 241, 0.15)',
                badgeColor: 'var(--text-accent)',
            };
    }
}

export default function BillingPage() {
    const [billing, setBilling] = useState<BillingStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);
    const [trialNote, setTrialNote] = useState('');
    const [trialLoading, setTrialLoading] = useState(false);
    const [trialError, setTrialError] = useState<string | null>(null);

    useEffect(() => { fetchBilling(); }, []);

    async function fetchBilling() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch('/api/v1/billing/status', {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (res.ok) {
                const data: BillingStatus = await res.json();
                setBilling(data);
            }
        } catch { }
        finally { setLoading(false); }
    }

    async function requestTrial() {
        setTrialLoading(true);
        setTrialError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setTrialError('Not authenticated. Please log in again.');
                return;
            }
            const res = await fetch('/api/v1/billing/trial-request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ note: trialNote }),
            });
            const data = await res.json();
            if (!res.ok) {
                setTrialError(data.error || 'Failed to submit trial request');
                return;
            }
            if (data.status) setBilling(data.status);
            setTrialNote('');
        } catch (err) {
            console.error('Trial request error:', err);
            setTrialError('Network error. Please try again.');
        } finally {
            setTrialLoading(false);
        }
    }

    async function handleCheckout(planId: string) {
        setCheckoutLoading(planId);
        setCheckoutError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setCheckoutError('Not authenticated. Please log in again.');
                return;
            }

            const res = await fetch('/api/v1/creem/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ plan: planId }),
            });

            const data = await res.json();

            if (!res.ok) {
                setCheckoutError(data.error || 'Failed to create checkout session');
                return;
            }

            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            } else {
                setCheckoutError('No checkout URL returned. Check Creem product configuration.');
            }
        } catch (err) {
            console.error('Checkout error:', err);
            setCheckoutError('Network error. Please try again.');
        } finally {
            setCheckoutLoading(null);
        }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                <div className="loading-spinner" style={{ width: '40px', height: '40px' }}></div>
            </div>
        );
    }

    const accessState: AccessState = billing?.accessState || 'no_key';
    const trialDaysLeft = billing?.trialEndsAt
        ? Math.max(0, Math.ceil((new Date(billing.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;
    const banner = bannerForState(accessState, trialDaysLeft);
    const bannerStyle = toneStyles(banner.tone);
    const showTrialRequest = accessState === 'no_key' || accessState === 'pending_payment';
    const urgent = accessState === 'trial_expired' || accessState === 'past_due' || accessState === 'canceled';
    const trialUrgent = accessState === 'trial_active' && trialDaysLeft !== null && trialDaysLeft <= 3;

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1>Billing & Plans</h1>
                    <p>Manage your subscription and plan</p>
                </div>
            </div>

            {/* Urgency hero for expired / past_due / canceled */}
            {urgent && (
                <div className="glass-card animate-fade-in" style={{
                    padding: '32px',
                    marginBottom: '24px',
                    background: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))',
                    border: '2px solid rgba(239,68,68,0.4)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '48px', lineHeight: 1 }}>🚫</div>
                        <div style={{ flex: 1, minWidth: '260px' }}>
                            <h2 style={{ fontSize: '24px', marginBottom: '8px', color: 'var(--color-deny)' }}>
                                {accessState === 'trial_expired' && 'Your free trial has ended'}
                                {accessState === 'past_due' && 'Your last payment failed'}
                                {accessState === 'canceled' && 'Your subscription is canceled'}
                            </h2>
                            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px', maxWidth: '560px', lineHeight: 1.6 }}>
                                {accessState === 'trial_expired' && 'Your API key is paused and your dashboard data is read-only. Subscribe to a paid plan below to restore full access immediately.'}
                                {accessState === 'past_due' && 'We could not charge your card on the last billing cycle. Subscribe again or update your payment method to avoid losing access. Your data is safe.'}
                                {accessState === 'canceled' && 'Your API key is paused. Subscribe again to restore the same key and continue where you left off — no data is lost.'}
                            </p>
                            <a href="#plans" className="btn btn-primary"
                                style={{ background: 'var(--color-deny)', borderColor: 'var(--color-deny)' }}>
                                Choose a plan ↓
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* Trial about-to-expire countdown hero */}
            {trialUrgent && (
                <div className="glass-card animate-fade-in" style={{
                    padding: '24px 28px',
                    marginBottom: '24px',
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(245,158,11,0.02))',
                    border: '2px solid rgba(245,158,11,0.4)',
                    display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap',
                }}>
                    <div style={{
                        fontSize: '64px', fontWeight: 800,
                        color: 'var(--color-challenge)', lineHeight: 1,
                        minWidth: '80px', textAlign: 'center',
                    }}>
                        {trialDaysLeft}
                    </div>
                    <div style={{ flex: 1, minWidth: '240px' }}>
                        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>
                            day{trialDaysLeft === 1 ? '' : 's'} left in your trial
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            Subscribe before your trial ends to keep your API key active without interruption.
                        </div>
                    </div>
                    <a href="#plans" className="btn btn-primary"
                        style={{ background: 'var(--color-challenge)', borderColor: 'var(--color-challenge)' }}>
                        Subscribe →
                    </a>
                </div>
            )}

            {/* Status banner */}
            <div className="glass-card" style={{
                padding: '24px', marginBottom: '24px',
                background: bannerStyle.background,
                border: bannerStyle.border,
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                            {banner.title}
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 700, textTransform: 'capitalize' }}>
                            {billing?.plan?.replace('_', ' ') || 'No plan'}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', maxWidth: '600px' }}>
                            {banner.body}
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span className="badge" style={{
                            fontSize: '12px', padding: '6px 14px',
                            color: bannerStyle.badgeColor,
                            border: `1px solid ${bannerStyle.badgeColor}40`,
                            background: 'transparent',
                        }}>
                            {accessState.replace(/_/g, ' ')}
                        </span>
                    </div>
                </div>
            </div>

            {/* Trial request card — only show when relevant */}
            {showTrialRequest && (
                <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Request a free trial</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                        Tell us a bit about your use case. Trials are reviewed manually and approved within 24 hours.
                    </p>
                    <textarea
                        value={trialNote}
                        onChange={e => setTrialNote(e.target.value.slice(0, 500))}
                        placeholder="What are you building? Expected volume?"
                        rows={3}
                        style={{ width: '100%', marginBottom: '12px', resize: 'vertical' }}
                    />
                    {trialError && (
                        <div style={{
                            padding: '10px 14px', marginBottom: '12px',
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: '8px', color: 'var(--color-deny)', fontSize: '13px',
                        }}>
                            {trialError}
                        </div>
                    )}
                    <button
                        onClick={requestTrial}
                        disabled={trialLoading}
                        className="btn btn-primary btn-sm"
                        style={{ cursor: trialLoading ? 'wait' : 'pointer' }}
                    >
                        {trialLoading ? 'Submitting...' : 'Request Free Trial'}
                    </button>
                </div>
            )}

            {/* Trial active info */}
            {accessState === 'trial_active' && trialDaysLeft !== null && (
                <div className="glass-card" style={{ padding: '20px 24px', marginBottom: '24px', background: 'var(--bg-secondary)' }}>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        <strong>{trialDaysLeft}</strong> day{trialDaysLeft === 1 ? '' : 's'} remaining in your free trial.
                        Subscribe below to keep your access active when the trial ends.
                    </div>
                </div>
            )}

            {/* Checkout error */}
            {checkoutError && (
                <div style={{
                    padding: '14px 20px', marginBottom: '24px',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '12px', color: 'var(--color-deny)',
                    fontSize: '14px', fontWeight: 600,
                }}>
                    {checkoutError}
                </div>
            )}

            {/* Plan cards */}
            <div id="plans" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '24px', scrollMarginTop: '24px' }}>
                {PLANS.map(plan => {
                    const isCurrent = billing?.plan === plan.id;
                    const isLoading = checkoutLoading === plan.id;
                    return (
                        <div key={plan.id} className="glass-card" style={{
                            padding: '24px', position: 'relative', overflow: 'hidden',
                            border: isCurrent ? `2px solid ${plan.color}` : '1px solid var(--border-subtle)',
                            transition: 'all 0.3s',
                        }}>
                            {plan.popular && (
                                <div style={{
                                    position: 'absolute', top: '12px', right: '-30px',
                                    background: plan.color, color: 'white',
                                    padding: '4px 40px', fontSize: '11px', fontWeight: 700,
                                    transform: 'rotate(45deg)', letterSpacing: '0.5px',
                                }}>
                                    POPULAR
                                </div>
                            )}

                            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>{plan.name}</div>
                            <div style={{ fontSize: '28px', fontWeight: 800, color: plan.color, marginBottom: '16px' }}>
                                {plan.price}
                            </div>

                            <ul style={{
                                margin: '0 0 20px', padding: '0', listStyle: 'none',
                                fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '2.2',
                            }}>
                                {plan.features.map(f => (
                                    <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ color: plan.color }}>✓</span> {f}
                                    </li>
                                ))}
                            </ul>

                            {plan.id === 'enterprise' ? (
                                <a href="mailto:tomascorzo1203@gmail.com"
                                    className="btn btn-sm"
                                    style={{
                                        width: '100%', textAlign: 'center', display: 'block',
                                        background: 'var(--bg-tertiary)',
                                        border: `1px solid ${plan.color}40`,
                                        color: plan.color,
                                    }}>
                                    Contact Sales
                                </a>
                            ) : isCurrent && billing?.subscriptionStatus === 'active' ? (
                                <button className="btn btn-sm" disabled
                                    style={{ width: '100%', opacity: 0.5 }}>
                                    Current Plan
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleCheckout(plan.id)}
                                    disabled={isLoading}
                                    className="btn btn-primary btn-sm"
                                    style={{
                                        width: '100%', textAlign: 'center',
                                        background: plan.color,
                                        borderColor: plan.color,
                                        cursor: isLoading ? 'wait' : 'pointer',
                                    }}>
                                    {isLoading ? 'Redirecting...' : 'Subscribe'}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* How payment activation works */}
            <div className="glass-card" style={{
                padding: '20px 24px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.06), rgba(168, 85, 247, 0.06))',
                border: '1px solid rgba(99, 102, 241, 0.15)',
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    <span style={{ fontSize: '28px' }}>⚡</span>
                    <div>
                        <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>
                            How activation works
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                            <strong>Paid plan:</strong> Click &quot;Subscribe&quot;, complete payment via Creem, and your dashboard + API unlock automatically.<br />
                            <strong>Free trial:</strong> Submit a request above. We review each one manually so we can be sure of fit. Approval usually takes under 24 hours.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
