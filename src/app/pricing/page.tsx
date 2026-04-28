'use client';

import { useState } from 'react';
import TopNav from '@/components/marketing/TopNav';
import Footer from '@/components/marketing/Footer';
import { CheckIcon } from '@/components/marketing/Icon';

interface Tier {
    name: string;
    monthly: string;
    yearly: string;
    sub: string;
    desc: string;
    ids: string;
    features: string[];
    cta: string;
    ctaHref: string;
    kind: 'outline' | 'accent';
    highlight?: boolean;
}

const TIERS: Tier[] = [
    {
        name: 'Free',
        monthly: '$0',
        yearly: '$0',
        sub: 'forever',
        desc: 'Trial-by-approval. Real abuse, real signal.',
        ids: '1k',
        features: [
            '1,000 verifications / mo',
            '7-day event retention',
            'Community support',
            'Up to 3 risk rules',
            'Single environment',
        ],
        cta: 'Request access',
        ctaHref: '/register',
        kind: 'outline',
    },
    {
        name: 'Pro',
        monthly: '$99',
        yearly: '$990',
        sub: '/ month',
        desc: 'For growing products with real abuse exposure.',
        ids: '50k',
        features: [
            '50,000 verifications / mo',
            '600 req/min',
            '30-day event retention',
            'Email support, 24h SLA',
            'Unlimited risk rules',
            'Webhooks + audit log',
            'Account-linking graph',
        ],
        cta: 'Start with Pro',
        ctaHref: '/register',
        kind: 'accent',
        highlight: true,
    },
    {
        name: 'Enterprise',
        monthly: 'Custom',
        yearly: 'Custom',
        sub: '',
        desc: 'For teams with compliance and scale needs.',
        ids: 'Volume',
        features: [
            'Volume pricing',
            'Unlimited retention',
            'Dedicated CSM, 1h SLA',
            'Self-hosted edge SDK',
            'SSO, SCIM, audit exports',
            'Custom DPA',
            'On-prem deployment',
        ],
        cta: 'Contact sales',
        ctaHref: 'mailto:tomascorzo1203@gmail.com',
        kind: 'outline',
    },
];

type ComparisonValue = string | boolean;
const COMPARISON: { l: string; v: [ComparisonValue, ComparisonValue, ComparisonValue] }[] = [
    { l: 'Verifications / month', v: ['1k', '50k', 'Volume'] },
    { l: 'Event retention', v: ['7 days', '30 days', 'Unlimited'] },
    { l: 'Risk rules', v: ['3', 'Unlimited', 'Unlimited'] },
    { l: 'Account-linking graph', v: [false, true, true] },
    { l: 'Webhooks', v: [false, true, true] },
    { l: 'SSO / SCIM', v: [false, false, true] },
    { l: 'Self-hosted SDK', v: [false, false, true] },
    { l: 'SOC 2 Type II report', v: [false, true, true] },
    { l: 'Support SLA', v: ['Community', '24h email', '1h dedicated'] },
];

export default function PricingPage() {
    const [annual, setAnnual] = useState(true);

    return (
        <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
            <TopNav current="pricing" />

            {/* Hero */}
            <section style={{ padding: '80px 32px 40px', textAlign: 'center', borderBottom: '1px solid var(--line)' }}>
                <div className="t-eyebrow" style={{ color: 'var(--accent)', marginBottom: 16 }}>// Pricing</div>
                <h1 className="t-h1" style={{ margin: '0 0 16px' }}>Pay only for what you protect.</h1>
                <p className="t-body-lg" style={{ maxWidth: 560, margin: '0 auto 32px' }}>
                    Usage-based pricing per verification. No seat fees, no minimums, no surprise overages.
                </p>
                <div style={{
                    display: 'inline-flex', padding: 4,
                    background: 'var(--bg-sunken)', borderRadius: 999,
                    border: '1px solid var(--line)',
                }}>
                    {[
                        { v: false, l: 'Monthly' },
                        { v: true, l: 'Annual · save 17%' },
                    ].map(o => (
                        <button key={o.l} onClick={() => setAnnual(o.v)} style={{
                            padding: '6px 16px', borderRadius: 999,
                            fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
                            background: annual === o.v ? 'var(--bg-elev)' : 'transparent',
                            border: '1px solid ' + (annual === o.v ? 'var(--line-strong)' : 'transparent'),
                            color: 'var(--ink)', fontWeight: 500,
                            boxShadow: annual === o.v ? 'var(--shadow-sm)' : 'none',
                        }}>{o.l}</button>
                    ))}
                </div>
            </section>

            {/* Plan cards */}
            <section style={{ padding: '40px 32px 80px' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {TIERS.map(t => (
                        <div key={t.name} className="card" style={{
                            padding: 28,
                            borderColor: t.highlight ? 'var(--accent)' : 'var(--line)',
                            boxShadow: t.highlight ? '0 0 0 1px var(--accent), var(--shadow-md)' : 'none',
                            position: 'relative',
                        }}>
                            {t.highlight && (
                                <span className="tag tag-accent" style={{ position: 'absolute', top: -10, right: 24 }}>
                                    Most popular
                                </span>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                <span style={{ fontSize: 14, fontWeight: 500 }}>{t.name}</span>
                                <span className="t-mono" style={{ fontSize: 11, color: 'var(--ink-4)' }}>{t.ids} ids</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                                <span style={{ fontSize: 44, fontWeight: 500, letterSpacing: '-0.03em', fontFamily: 'var(--font-mono)' }}>
                                    {annual ? t.yearly : t.monthly}
                                </span>
                                <span className="t-body-sm">{t.sub}{annual && t.sub === '/ month' ? ' / yr' : ''}</span>
                            </div>
                            <p className="t-body-sm" style={{ marginTop: 0, marginBottom: 24, fontSize: 13 }}>{t.desc}</p>
                            <a href={t.ctaHref} className={`btn btn-${t.kind}`} style={{ width: '100%', justifyContent: 'center', marginBottom: 24 }}>
                                {t.cta}
                            </a>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {t.features.map(f => (
                                    <div key={f} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--ink-2)' }}>
                                        <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}>
                                            <CheckIcon />
                                        </span>
                                        <span>{f}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Compare table */}
                <div style={{ maxWidth: 1200, margin: '80px auto 0' }}>
                    <div className="t-eyebrow" style={{ marginBottom: 24, textAlign: 'center' }}>// Full comparison</div>
                    <div className="card" style={{ overflow: 'hidden' }}>
                        <div style={{
                            display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
                            padding: '14px 24px', alignItems: 'center',
                            borderBottom: '1px solid var(--line)',
                            fontSize: 12,
                            background: 'var(--bg-sunken)',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--ink-3)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                        }}>
                            <span>Feature</span>
                            {TIERS.map(t => (
                                <span key={t.name} style={{ textAlign: 'center' }}>{t.name}</span>
                            ))}
                        </div>
                        {COMPARISON.map((row, i) => (
                            <div key={row.l} style={{
                                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
                                padding: '14px 24px', alignItems: 'center',
                                borderBottom: i < COMPARISON.length - 1 ? '1px solid var(--line)' : 'none',
                                fontSize: 13,
                                background: i % 2 === 0 ? 'transparent' : 'var(--bg-sunken)',
                            }}>
                                <span style={{ color: 'var(--ink-2)' }}>{row.l}</span>
                                {row.v.map((v, j) => (
                                    <span key={j} className="t-mono" style={{ fontSize: 12, color: 'var(--ink)', textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
                                        {v === true ? <span style={{ color: 'var(--accent)' }}><CheckIcon /></span>
                                            : v === false ? <span style={{ color: 'var(--ink-4)' }}>—</span>
                                                : v}
                                    </span>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
}
