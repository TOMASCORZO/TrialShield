'use client';

import { useState, useEffect } from 'react';

interface BillingInfo {
    plan: string;
    subscriptionStatus: string;
    polarCustomerId?: string;
    trialEndsAt?: string;
    totalRequests: number;
    rateLimit: number;
}

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

export default function BillingPage() {
    const [billing, setBilling] = useState<BillingInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [linkingKey, setLinkingKey] = useState('');
    const [linkMessage, setLinkMessage] = useState('');

    const apiKey = typeof window !== 'undefined'
        ? (process.env.NEXT_PUBLIC_TRIALSHIELD_TEST_KEY || 'master')
        : 'master';

    useEffect(() => { fetchBilling(); }, []);

    async function fetchBilling() {
        try {
            const res = await fetch('/api/v1/keys', {
                headers: { 'X-API-Key': apiKey },
            });
            const data = await res.json();
            const key = data.keys?.[0];
            if (key) {
                setBilling({
                    plan: key.plan || 'free_trial',
                    subscriptionStatus: key.subscription_status || 'trialing',
                    polarCustomerId: key.polar_customer_id,
                    trialEndsAt: key.trial_ends_at,
                    totalRequests: key.total_requests || 0,
                    rateLimit: key.rate_limit || 30,
                });
            }
        } catch { }
        finally { setLoading(false); }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                <div className="loading-spinner" style={{ width: '40px', height: '40px' }}></div>
            </div>
        );
    }

    const isPaid = billing && !['free_trial', 'pending'].includes(billing.plan);
    const isActive = billing?.subscriptionStatus === 'active';
    const isPending = billing?.plan === 'pending' || billing?.subscriptionStatus === 'pending';
    const trialDaysLeft = billing?.trialEndsAt && billing.plan === 'free_trial'
        ? Math.max(0, Math.ceil((new Date(billing.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1>💰 Billing & Plans</h1>
                    <p>Manage your subscription and plan</p>
                </div>
            </div>

            {/* Current plan status */}
            <div className="glass-card" style={{
                padding: '24px', marginBottom: '24px',
                background: isPaid && isActive
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.06), rgba(16, 185, 129, 0.02))'
                    : isPending
                        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.06), rgba(239, 68, 68, 0.02))'
                        : 'linear-gradient(135deg, rgba(245, 158, 11, 0.06), rgba(245, 158, 11, 0.02))',
                border: isPaid && isActive
                    ? '1px solid rgba(16, 185, 129, 0.2)'
                    : isPending
                        ? '1px solid rgba(239, 68, 68, 0.2)'
                        : '1px solid rgba(245, 158, 11, 0.2)',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                            Current Plan
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 800, textTransform: 'capitalize' }}>
                            {isPending ? 'No Active Plan' : billing?.plan?.replace('_', ' ') || 'No Plan'}
                        </div>
                        {isPending && (
                            <div style={{ fontSize: '13px', color: 'var(--color-deny)', marginTop: '4px' }}>
                                🔒 Payment required to activate your API key
                            </div>
                        )}
                        {trialDaysLeft !== null && (
                            <div style={{ fontSize: '13px', color: trialDaysLeft < 7 ? 'var(--color-deny)' : 'var(--color-challenge)', marginTop: '4px' }}>
                                ⏰ {trialDaysLeft} days remaining in free trial
                            </div>
                        )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span className={`badge ${isActive ? 'badge-allow' : isPending ? 'badge-deny' : billing?.subscriptionStatus === 'trialing' ? 'badge-allow' : 'badge-deny'}`}
                            style={{ fontSize: '12px', padding: '6px 14px' }}>
                            {isPending ? 'Payment Required' :
                                billing?.subscriptionStatus === 'trialing' ? 'Trial Active' :
                                    billing?.subscriptionStatus || 'Unknown'}
                        </span>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                            {billing?.totalRequests?.toLocaleString() || 0} total requests
                        </div>
                    </div>
                </div>
            </div>

            {/* Plan cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '24px' }}>
                {PLANS.map(plan => {
                    const isCurrent = billing?.plan === plan.id;
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
                                <a href="mailto:tomas@trialshield.dev"
                                    className="btn btn-sm"
                                    style={{
                                        width: '100%', textAlign: 'center', display: 'block',
                                        background: 'var(--bg-tertiary)',
                                        border: `1px solid ${plan.color}40`,
                                        color: plan.color,
                                    }}>
                                    Contact Sales
                                </a>
                            ) : isCurrent ? (
                                <button className="btn btn-sm" disabled
                                    style={{ width: '100%', opacity: 0.5 }}>
                                    Current Plan
                                </button>
                            ) : (
                                <a href={`https://polar.sh/trialshield/checkout?product=${plan.id}`}
                                    target="_blank" rel="noopener"
                                    className="btn btn-primary btn-sm"
                                    style={{
                                        width: '100%', textAlign: 'center', display: 'block',
                                        background: plan.color,
                                        borderColor: plan.color,
                                    }}>
                                    {isPaid ? 'Switch Plan' : 'Subscribe'}
                                </a>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* How payment activation works */}
            <div className="glass-card" style={{
                padding: '20px 24px', marginBottom: '24px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.06), rgba(168, 85, 247, 0.06))',
                border: '1px solid rgba(99, 102, 241, 0.15)',
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    <span style={{ fontSize: '28px' }}>⚡</span>
                    <div>
                        <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>
                            How Payment Activation Works
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                            <strong>1.</strong> Click &quot;Subscribe&quot; on your chosen plan → you&apos;ll be redirected to <strong>Polar.sh</strong><br />
                            <strong>2.</strong> Complete the payment on Polar.sh<br />
                            <strong>3.</strong> Polar sends a webhook to TrialShield → <strong>your API key is automatically activated</strong><br />
                            <strong>4.</strong> That&apos;s it! Your API key is now authorized with the new plan and rate limits<br />
                            <br />
                            🔄 Upgrades, downgrades, and cancellations are all handled automatically via Polar.sh webhooks.
                        </div>
                    </div>
                </div>
            </div>

            {/* Usage stats */}
            <div className="glass-card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '20px' }}>📊 Usage Summary</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '10px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Requests</div>
                        <div style={{ fontSize: '24px', fontWeight: 800 }}>{billing?.totalRequests?.toLocaleString() || 0}</div>
                    </div>
                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '10px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Rate Limit</div>
                        <div style={{ fontSize: '24px', fontWeight: 800 }}>{billing?.rateLimit || 30}/min</div>
                    </div>
                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '10px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Plan</div>
                        <div style={{ fontSize: '24px', fontWeight: 800, textTransform: 'capitalize' }}>
                            {billing?.plan?.replace('_', ' ') || 'Trial'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
