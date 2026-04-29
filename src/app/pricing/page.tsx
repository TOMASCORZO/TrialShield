'use client';

// Pricing page — faithful port of the Claude Design "Choose your plan" layout
// (Fingerprint-style shared volume slider that drives all three tier cards).

import { useState } from 'react';
import TopNav from '@/components/marketing/TopNav';
import Footer from '@/components/marketing/Footer';
import { CheckIcon } from '@/components/marketing/Icon';

const STOPS = [3_000, 20_000, 100_000, 200_000, 500_000, 1_000_000];

// Pro Plus pricing buckets keyed to the slider stops.
const PRO_PRICE: Record<number, number> = {
    3_000: 50,
    20_000: 99,
    100_000: 299,
    200_000: 499,
    500_000: 1_099,
    1_000_000: 1_999,
};

function fmtVol(n: number): string {
    if (n >= 1_000_000) return `${n / 1_000_000}M+`;
    if (n >= 1_000) return `${n / 1_000}K`;
    return String(n);
}

type V = string | boolean;

export default function PricingPage() {
    const [idx, setIdx] = useState(1); // default 20K
    const currentVol = STOPS[idx];
    const pct = (idx / (STOPS.length - 1)) * 100;
    const proPrice = PRO_PRICE[currentVol];

    const COMPARISON: { l: string; v: [V, V, V] }[] = [
        { l: 'Identifications / month', v: ['1k', `${fmtVol(currentVol)}+`, 'Volume'] },
        { l: 'Event retention', v: ['7 days', '30 days', 'Unlimited'] },
        { l: 'All 17 detection modules', v: [false, true, true] },
        { l: 'Account-linking graph', v: [false, true, true] },
        { l: 'Adaptive challenges', v: [false, true, true] },
        { l: 'Webhooks', v: [false, true, true] },
        { l: 'SSO / SCIM', v: [false, false, true] },
        { l: 'Self-hosted SDK', v: [false, false, true] },
        { l: 'SOC 2 Type II report', v: [false, true, true] },
        { l: 'Support SLA', v: ['Community', '24h email', '1h dedicated'] },
    ];

    return (
        <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
            <TopNav current="pricing" />

            {/* ─── Title + slider ─────────────────────────────── */}
            <section style={{ padding: '72px 32px 48px', textAlign: 'center', borderBottom: '1px solid var(--line)' }}>
                <h1 className="t-h1" style={{ margin: '0 0 16px', fontSize: 64 }}>
                    Choose <span style={{ color: 'var(--accent)' }}>your</span> plan
                </h1>
                <p style={{ fontSize: 16, color: 'var(--ink-2)', marginTop: 0, marginBottom: 40 }}>
                    Select your number of <span style={{ borderBottom: '1px solid var(--ink-3)', paddingBottom: 1 }}>monthly identifications</span>
                </p>

                {/* The shared slider */}
                <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative' }}>
                    <div style={{ position: 'relative', height: 8 }}>
                        {/* Track */}
                        <div style={{
                            position: 'absolute', left: 0, right: 0, top: 2,
                            height: 4, borderRadius: 999, background: '#E8EAF0',
                        }} />
                        {/* Filled portion */}
                        <div style={{
                            position: 'absolute', left: 0, top: 2, height: 4,
                            width: `${pct}%`,
                            borderRadius: 999, background: 'var(--accent)',
                            transition: 'width 200ms ease',
                        }} />
                        {/* Thumb */}
                        <div style={{
                            position: 'absolute', left: `calc(${pct}% - 10px)`, top: -4,
                            width: 20, height: 20, borderRadius: 999,
                            background: 'var(--accent)',
                            border: '3px solid #fff',
                            boxShadow: '0 0 0 1px var(--accent), 0 2px 8px rgba(22, 82, 240, 0.4)',
                            transition: 'left 200ms ease',
                            pointerEvents: 'none',
                        }} />
                        {/* Native input on top — invisible, drives state */}
                        <input
                            type="range"
                            min={0}
                            max={STOPS.length - 1}
                            step={1}
                            value={idx}
                            onChange={e => setIdx(parseInt(e.target.value))}
                            aria-label="Monthly identifications volume"
                            style={{
                                position: 'absolute', inset: '-8px 0',
                                width: '100%', height: 24,
                                opacity: 0, cursor: 'pointer', margin: 0,
                            }}
                        />
                    </div>

                    {/* Stop labels — clickable */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        marginTop: 18, fontSize: 13, color: 'var(--ink-3)',
                        fontWeight: 500,
                    }}>
                        {STOPS.map((s, i) => (
                            <button
                                key={s}
                                onClick={() => setIdx(i)}
                                style={{
                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                    color: idx === i ? 'var(--accent)' : 'var(--ink-3)',
                                    fontWeight: idx === i ? 600 : 500,
                                    fontSize: 13, fontFamily: 'inherit',
                                    padding: '4px 8px',
                                }}
                            >
                                {fmtVol(s)}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Tier cards ─────────────────────────────────── */}
            <section style={{ padding: '48px 32px 80px' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                    {/* Free */}
                    <div className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <span style={{ fontSize: 22, fontWeight: 500 }}>Free</span>
                            <span className="tag tag-accent" style={{ fontSize: 10, padding: '2px 7px' }}>New!</span>
                        </div>
                        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '0 0 20px' }}>
                            Web and mobile device identification.
                        </p>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 36, fontWeight: 500, letterSpacing: '-0.02em' }}>$0</span>
                            <span className="t-body-sm">/month</span>
                        </div>
                        <p className="t-body-sm" style={{ margin: '0 0 20px', fontSize: 12 }}>
                            up to 1,000 API calls per month
                        </p>
                        <a href="/register" className="btn btn-outline" style={{ alignSelf: 'flex-start', marginBottom: 24 }}>
                            Start Free
                        </a>
                        <div className="t-body-sm" style={{ fontSize: 12, marginBottom: 12 }}>Includes:</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[
                                '14 day free trial of Pro plan',
                                'Device Fingerprinting',
                                'Email Intelligence',
                                <span key="android">500k Android API calls/mo <span className="tag tag-accent" style={{ fontSize: 9, padding: '1px 6px', marginLeft: 4 }}>Free!</span></span>,
                                'Basic Risk Scoring',
                                '7-day event retention',
                            ].map((f, i) => (
                                <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--ink-2)' }}>
                                    <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}>
                                        <CheckIcon />
                                    </span>
                                    <span>{f}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Pro Plus — animated */}
                    <div className="card" style={{
                        padding: 32,
                        borderColor: 'var(--accent)',
                        boxShadow: '0 0 0 1px var(--accent), var(--shadow-md)',
                        position: 'relative',
                        display: 'flex', flexDirection: 'column',
                    }}>
                        <span className="tag tag-accent" style={{ position: 'absolute', top: -10, right: 24 }}>Most popular</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                            <span style={{ fontSize: 22, fontWeight: 500 }}>Pro</span>
                            <span style={{ fontSize: 22, fontWeight: 500, color: 'var(--accent)' }}>Plus</span>
                        </div>
                        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '0 0 20px' }}>
                            Everything you need starting at
                        </p>
                        <div style={{
                            display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4,
                            fontVariantNumeric: 'tabular-nums',
                        }}>
                            <span style={{
                                fontSize: 36, fontWeight: 500, letterSpacing: '-0.02em',
                                transition: 'color 150ms',
                            }}>${proPrice.toLocaleString()}</span>
                            <span className="t-body-sm">
                                /month for {fmtVol(currentVol)} API calls
                            </span>
                        </div>
                        <p className="t-body-sm" style={{ margin: '0 0 20px', fontSize: 12 }}>
                            then $4 per 1,000 additional API calls
                        </p>
                        <a href="/register" className="btn btn-accent" style={{ alignSelf: 'flex-start', marginBottom: 24 }}>
                            Start Free
                        </a>
                        <div className="t-body-sm" style={{ fontSize: 12, marginBottom: 12 }}>Includes:</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[
                                'Device Fingerprinting',
                                'All 17 detection modules',
                                'Account-linking graph',
                                'ML Risk Scoring',
                                'Adaptive Challenges',
                                'Webhooks + audit log',
                                '30-day event retention',
                                'Email support, 24h SLA',
                            ].map((f, i) => (
                                <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--ink-2)' }}>
                                    <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}>
                                        <CheckIcon />
                                    </span>
                                    <span>{f}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Enterprise */}
                    <div className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ marginBottom: 12 }}>
                            <span style={{ fontSize: 22, fontWeight: 500, color: 'var(--accent)' }}>Enterprise</span>
                        </div>
                        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '0 0 20px' }}>
                            Build your own plan.
                        </p>
                        <div style={{ marginBottom: 4 }}>
                            <span style={{ fontSize: 36, fontWeight: 500, letterSpacing: '-0.02em' }}>Custom</span>
                        </div>
                        <p className="t-body-sm" style={{ margin: '0 0 20px', fontSize: 12 }}>
                            volume pricing from $0.0018 / id
                        </p>
                        <a
                            href="mailto:tomascorzo1203@gmail.com"
                            className="btn btn-outline"
                            style={{ alignSelf: 'flex-start', marginBottom: 24, borderColor: 'var(--accent)', color: 'var(--accent)' }}
                        >
                            Contact Sales
                        </a>
                        <div className="t-body-sm" style={{ fontSize: 12, marginBottom: 12 }}>Customize your plan:</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[
                                'Everything in Pro Plus',
                                'Custom signal weights',
                                <span key="edge">Self-hosted edge SDK<span style={{ color: 'var(--ink-4)' }}>*</span></span>,
                                '99.9% SLA',
                                'SSO, SCIM, audit exports',
                                'Dedicated CSM, 1h SLA',
                                'Custom DPA, SOC 2 Type II',
                                'On-prem deployment',
                            ].map((f, i) => (
                                <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--ink-2)' }}>
                                    <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}>
                                        <CheckIcon />
                                    </span>
                                    <span>{f}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Compare table */}
                <div style={{ maxWidth: 1200, margin: '80px auto 0' }}>
                    <div className="t-eyebrow" style={{ marginBottom: 24, textAlign: 'center' }}>// Full comparison</div>
                    <div className="card" style={{ overflow: 'hidden' }}>
                        {COMPARISON.map((row, i, arr) => (
                            <div key={row.l} style={{
                                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
                                padding: '14px 24px', alignItems: 'center',
                                borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none',
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
