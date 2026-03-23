export default function PricingPage() {
    const PLANS = [
        {
            name: 'Starter',
            price: '$29',
            period: '/mo',
            description: 'For early-stage startups protecting their first product.',
            color: '#6366f1',
            features: [
                '5,000 users/mo',
                '120 requests/min',
                'Email, IP & device intelligence',
                'OAuth provider integration',
                'Stripe card fingerprinting',
                'Dashboard & analytics',
                'Email support',
            ],
        },
        {
            name: 'Pro',
            price: '$99',
            period: '/mo',
            description: 'For growing companies that need full fraud coverage.',
            color: '#8b5cf6',
            popular: true,
            features: [
                '50,000 users/mo',
                '600 requests/min',
                'Everything in Starter',
                'Graph analysis & clustering',
                'Duplicate user detection engine',
                'Compliance module (GDPR/CCPA)',
                'Post-signup monitoring',
                'Priority support',
            ],
        },
        {
            name: 'Enterprise',
            price: 'Custom',
            period: '',
            description: 'For large-scale operations with custom requirements.',
            color: '#ec4899',
            features: [
                'Unlimited users',
                '3,000 requests/min',
                'Everything in Pro',
                'Dedicated infrastructure',
                'Custom rules engine',
                'SLA guarantee (99.99%)',
                'Slack & webhook integrations',
                'Dedicated account manager',
            ],
        },
    ];

    return (
        <>
            <nav className="landing-nav">
                <a href="/" className="landing-logo">
                    🛡️ <span>TrialShield</span>
                </a>
                <ul className="landing-nav-links">
                    <li><a href="/#features">Features</a></li>
                    <li><a href="/pricing">Pricing</a></li>
                    <li><a href="/docs">Docs</a></li>
                    <li><a href="/terms">Terms</a></li>
                    <li><a href="/privacy">Privacy</a></li>
                    <li><a href="/login" className="btn btn-secondary btn-sm" style={{ border: 'none', background: 'transparent' }}>Login</a></li>
                    <li><a href="/register" className="btn btn-primary btn-sm">Get Started →</a></li>
                </ul>
            </nav>

            <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '80px 24px 60px' }}>
                <div className="section-header" style={{ marginBottom: '48px' }}>
                    <h1 style={{ fontSize: '40px', fontWeight: 800 }}>
                        Simple, <span className="gradient-text">Transparent</span> Pricing
                    </h1>
                    <p style={{ fontSize: '16px', maxWidth: '500px', margin: '16px auto 0' }}>
                        No hidden fees. No per-evaluation charges. Just a flat monthly rate that scales with your business.
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '64px' }}>
                    {PLANS.map(plan => (
                        <div key={plan.name} className="glass-card" style={{
                            padding: '32px', position: 'relative', overflow: 'hidden',
                            border: plan.popular ? `2px solid ${plan.color}` : '1px solid var(--border-subtle)',
                        }}>
                            {plan.popular && (
                                <div style={{
                                    position: 'absolute', top: '14px', right: '-28px',
                                    background: plan.color, color: 'white',
                                    padding: '4px 40px', fontSize: '11px', fontWeight: 700,
                                    transform: 'rotate(45deg)', letterSpacing: '0.5px',
                                }}>
                                    POPULAR
                                </div>
                            )}

                            <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>{plan.name}</div>
                            <div style={{ marginBottom: '12px' }}>
                                <span style={{ fontSize: '42px', fontWeight: 800, color: plan.color }}>{plan.price}</span>
                                <span style={{ fontSize: '16px', color: 'var(--text-muted)' }}>{plan.period}</span>
                            </div>
                            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
                                {plan.description}
                            </p>

                            <ul style={{ margin: '0 0 28px', padding: '0', listStyle: 'none', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '2.2' }}>
                                {plan.features.map(f => (
                                    <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ color: plan.color }}>✓</span> {f}
                                    </li>
                                ))}
                            </ul>

                            {plan.name === 'Enterprise' ? (
                                <a href="mailto:tomascorzo1203@gmail.com" className="btn btn-sm" style={{
                                    width: '100%', textAlign: 'center', display: 'block',
                                    background: 'var(--bg-tertiary)', border: `1px solid ${plan.color}40`, color: plan.color,
                                }}>
                                    Contact Sales
                                </a>
                            ) : (
                                <a href="/register" className="btn btn-primary btn-sm" style={{
                                    width: '100%', textAlign: 'center', display: 'block',
                                    background: plan.color, borderColor: plan.color,
                                }}>
                                    Get Started
                                </a>
                            )}
                        </div>
                    ))}
                </div>

                {/* FAQ */}
                <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                    <h2 style={{ fontSize: '28px', fontWeight: 800, textAlign: 'center', marginBottom: '32px' }}>
                        Frequently Asked Questions
                    </h2>
                    {[
                        { q: 'What counts as a "user"?', a: 'Each unique evaluation request to the /verify endpoint counts as one user. Re-evaluations of the same user within 24 hours are not double-counted.' },
                        { q: 'Can I switch plans at any time?', a: 'Yes. Upgrades take effect immediately. Downgrades apply at the end of your current billing cycle.' },
                        { q: 'Is there a free trial?', a: 'We offer free trials on a case-by-case basis. Contact us to discuss your needs.' },
                        { q: 'What payment methods do you accept?', a: 'We accept all major credit cards and debit cards through our payment processor Creem. (pending approval)' },
                        { q: 'Do you offer annual billing?', a: 'Yes. Contact us for annual pricing with a discount.' },
                    ].map(faq => (
                        <div key={faq.q} className="glass-card" style={{ padding: '20px 24px', marginBottom: '12px' }}>
                            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>{faq.q}</div>
                            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{faq.a}</div>
                        </div>
                    ))}
                </div>
            </section>

            <footer className="footer">
                <p>🛡️ <strong>TrialShield</strong> — Stop trial abuse. Protect your revenue.</p>
                <p style={{ marginTop: '8px' }}>
                    <a href="/dashboard">Dashboard</a> · <a href="/docs">API Docs</a> · <a href="/pricing">Pricing</a> · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a>
                </p>
            </footer>
        </>
    );
}
