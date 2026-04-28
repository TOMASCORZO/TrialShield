'use client';

import { useMemo, useState } from 'react';
import TopNav from '@/components/marketing/TopNav';
import Footer from '@/components/marketing/Footer';
import { CheckIcon } from '@/components/marketing/Icon';

// Volume tiers used by the slider. Pro price scales with the chosen tier.
const TIERS = [
    { label: '20k', value: 20_000 },
    { label: '100k', value: 100_000 },
    { label: '200k', value: 200_000 },
    { label: '500k', value: 500_000 },
    { label: '1M+', value: 1_000_000 },
];

// Per-call rates (USD) used in the breakdown card.
const UNIT_PRICES = {
    verify: 0.001,
    monitor: 0.0002,
    kyc: 0.10,
};

// Pro tier: $50 base for the first 20k verifications, then $0.001 each.
// Once the user hits 1M, we tip them into the Enterprise / Custom band.
function estimateProPrice(volume: number): number | null {
    if (volume >= 1_000_000) return null;
    const included = 20_000;
    const overage = Math.max(0, volume - included);
    return 50 + overage * UNIT_PRICES.verify;
}

function formatUsd(n: number): string {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

const FREE_FEATURES = [
    '1,000 verifications / mo',
    '7-day event retention',
    'Email & IP intelligence',
    'Device fingerprinting',
    'Community support',
];

const PRO_FEATURES = [
    'Email + Phone + IP intelligence',
    'Device fingerprinting + behavioral signals',
    'Account-linking graph',
    '30-day event retention',
    'Webhooks + audit log',
    'Email support, 24h SLA',
];

const ENT_FEATURES = [
    'Volume pricing from $0.0005',
    'Unlimited retention',
    'Dedicated CSM, 1h SLA',
    'Self-hosted edge SDK',
    'SSO, SCIM, audit exports',
    'Custom DPA, SOC 2 Type II',
];

type V = string | boolean;
const COMPARISON: { l: string; v: [V, V, V] }[] = [
    { l: 'Verifications / month', v: ['1k', 'Up to 500k', 'Volume'] },
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
    const [tierIndex, setTierIndex] = useState(1); // start at 100k
    const tier = TIERS[tierIndex];
    const isCustom = tier.value >= 1_000_000;
    const proPrice = useMemo(() => estimateProPrice(tier.value), [tier.value]);
    const sliderPct = (tierIndex / (TIERS.length - 1)) * 100;

    return (
        <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
            <TopNav current="pricing" />

            {/* ─── Hero ─────────────────────────────────────────── */}
            <section style={{ padding: '80px 32px 32px', textAlign: 'center', borderBottom: '1px solid var(--line)' }}>
                <div className="t-eyebrow" style={{ color: 'var(--accent)', marginBottom: 16 }}>// Pricing</div>
                <h1 className="t-h1" style={{ margin: '0 0 16px' }}>Pay only for what you protect.</h1>
                <p className="t-body-lg" style={{ maxWidth: 560, margin: '0 auto' }}>
                    Usage-based pricing per verification. No seat fees, no minimums, no surprise overages.
                </p>
            </section>

            {/* ─── Volume slider ────────────────────────────────── */}
            <section style={{ padding: '48px 32px 16px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ maxWidth: 720, margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
                        <div className="t-eyebrow">// Monthly verifications</div>
                        <div className="t-mono" style={{ fontSize: 13, color: 'var(--ink)' }}>
                            {tier.label}
                            <span style={{ color: 'var(--ink-4)' }}> verifications / mo</span>
                        </div>
                    </div>

                    <input
                        type="range"
                        min={0}
                        max={TIERS.length - 1}
                        step={1}
                        value={tierIndex}
                        onChange={e => setTierIndex(Number(e.target.value))}
                        aria-label="Monthly verifications volume"
                        style={{
                            width: '100%',
                            height: 4,
                            appearance: 'none',
                            WebkitAppearance: 'none',
                            background: `linear-gradient(to right, var(--accent) 0 ${sliderPct}%, var(--line) ${sliderPct}% 100%)`,
                            borderRadius: 999,
                            outline: 'none',
                            cursor: 'pointer',
                        }}
                    />

                    <div style={{
                        display: 'flex', justifyContent: 'space-between', marginTop: 14,
                        fontFamily: 'var(--font-mono)', fontSize: 12,
                    }}>
                        {TIERS.map((t, i) => (
                            <button
                                key={t.label}
                                onClick={() => setTierIndex(i)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: '4px 0',
                                    color: i === tierIndex ? 'var(--ink)' : 'var(--ink-4)',
                                    fontWeight: i === tierIndex ? 600 : 400,
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    letterSpacing: '0.02em',
                                }}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Plan cards ───────────────────────────────────── */}
            <section style={{ padding: '40px 32px 32px' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {/* Free */}
                    <div className="card" style={{ padding: 28, position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <span style={{ fontSize: 14, fontWeight: 500 }}>Free</span>
                            <span className="t-mono" style={{ fontSize: 11, color: 'var(--ink-4)' }}>1k ids</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                            <span style={{ fontSize: 44, fontWeight: 500, letterSpacing: '-0.03em', fontFamily: 'var(--font-mono)' }}>
                                $0
                            </span>
                            <span className="t-body-sm">/ month</span>
                        </div>
                        <p className="t-body-sm" style={{ marginTop: 0, marginBottom: 24, fontSize: 13 }}>
                            For prototypes and trial-by-approval.
                        </p>
                        <a href="/register" className="btn btn-outline" style={{ width: '100%', justifyContent: 'center', marginBottom: 24 }}>
                            Request access
                        </a>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {FREE_FEATURES.map(f => (
                                <div key={f} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--ink-2)' }}>
                                    <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}>
                                        <CheckIcon />
                                    </span>
                                    <span>{f}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Pro — highlighted, dynamic price */}
                    <div className="card" style={{
                        padding: 28, position: 'relative',
                        borderColor: 'var(--accent)',
                        boxShadow: '0 0 0 1px var(--accent), var(--shadow-md)',
                    }}>
                        <span className="tag tag-accent" style={{ position: 'absolute', top: -10, right: 24 }}>
                            Most popular
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <span style={{ fontSize: 14, fontWeight: 500 }}>Pro</span>
                            <span className="t-mono" style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                                up to {tier.label}
                            </span>
                        </div>
                        {isCustom || proPrice === null ? (
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                                <span style={{ fontSize: 44, fontWeight: 500, letterSpacing: '-0.03em', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                                    Custom
                                </span>
                                <span className="t-body-sm">at this volume</span>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                                <span style={{ fontSize: 44, fontWeight: 500, letterSpacing: '-0.03em', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                                    {formatUsd(proPrice)}
                                </span>
                                <span className="t-body-sm">/ month</span>
                            </div>
                        )}
                        <p className="t-body-sm" style={{ marginTop: 0, marginBottom: 4, fontSize: 13 }}>
                            For products with real abuse exposure.
                        </p>
                        {!isCustom && (
                            <p className="t-mono" style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 0, marginBottom: 24 }}>
                                $50 base + ${UNIT_PRICES.verify.toFixed(3)} / verification over 20k
                            </p>
                        )}
                        {isCustom && (
                            <div style={{ marginBottom: 24 }} />
                        )}
                        <a
                            href={isCustom ? 'mailto:tomascorzo1203@gmail.com' : '/register'}
                            className="btn btn-accent"
                            style={{ width: '100%', justifyContent: 'center', marginBottom: 24 }}
                        >
                            {isCustom ? 'Contact sales' : 'Start with Pro'}
                        </a>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {PRO_FEATURES.map(f => (
                                <div key={f} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--ink-2)' }}>
                                    <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}>
                                        <CheckIcon />
                                    </span>
                                    <span>{f}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Enterprise */}
                    <div className="card" style={{ padding: 28, position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <span style={{ fontSize: 14, fontWeight: 500 }}>Enterprise</span>
                            <span className="t-mono" style={{ fontSize: 11, color: 'var(--ink-4)' }}>Volume</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                            <span style={{ fontSize: 44, fontWeight: 500, letterSpacing: '-0.03em', fontFamily: 'var(--font-mono)' }}>
                                Custom
                            </span>
                        </div>
                        <p className="t-body-sm" style={{ marginTop: 0, marginBottom: 24, fontSize: 13 }}>
                            For teams with compliance and scale needs.
                        </p>
                        <a href="mailto:tomascorzo1203@gmail.com" className="btn btn-outline" style={{ width: '100%', justifyContent: 'center', marginBottom: 24 }}>
                            Contact sales
                        </a>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {ENT_FEATURES.map(f => (
                                <div key={f} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--ink-2)' }}>
                                    <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}>
                                        <CheckIcon />
                                    </span>
                                    <span>{f}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Per-unit breakdown ───────────────────────────── */}
            <section style={{ padding: '0 32px 64px' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <div className="card" style={{ overflow: 'hidden' }}>
                        <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                            background: 'var(--bg-sunken)', borderBottom: '1px solid var(--line)',
                        }}>
                            {[
                                { l: 'Verify', v: `$${UNIT_PRICES.verify.toFixed(3)}`, sub: 'per call' },
                                { l: 'Monitor', v: `$${UNIT_PRICES.monitor.toFixed(4)}`, sub: 'per event' },
                                { l: 'KYC session', v: `$${UNIT_PRICES.kyc.toFixed(2)}`, sub: 'per verification' },
                            ].map((u, i) => (
                                <div key={u.l} style={{
                                    padding: '20px 24px',
                                    borderRight: i < 2 ? '1px solid var(--line)' : 'none',
                                }}>
                                    <div className="t-eyebrow" style={{ marginBottom: 8 }}>{u.l}</div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                        <span style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>
                                            {u.v}
                                        </span>
                                        <span className="t-body-sm" style={{ fontSize: 12 }}>{u.sub}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: '14px 24px', fontSize: 12, color: 'var(--ink-3)' }}>
                            All Pro overage rates apply after the included 20k verifications. Volume discounts kick in automatically once your monthly usage crosses 500k.
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Compare table ────────────────────────────────── */}
            <section style={{ padding: '0 32px 80px' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <div className="t-eyebrow" style={{ marginBottom: 24, textAlign: 'center' }}>// Full comparison</div>
                    <div className="card" style={{ overflow: 'hidden' }}>
                        <div style={{
                            display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
                            padding: '14px 24px', alignItems: 'center',
                            borderBottom: '1px solid var(--line)',
                            fontSize: 11,
                            background: 'var(--bg-sunken)',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--ink-3)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                        }}>
                            <span>Feature</span>
                            <span style={{ textAlign: 'center' }}>Free</span>
                            <span style={{ textAlign: 'center' }}>Pro</span>
                            <span style={{ textAlign: 'center' }}>Enterprise</span>
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
                                    <span key={j} className="t-mono" style={{
                                        fontSize: 12, color: 'var(--ink)',
                                        textAlign: 'center', display: 'flex', justifyContent: 'center',
                                    }}>
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
