'use client';

import { useState, useMemo } from 'react';

const TIERS = [
    { label: '20K', value: 20_000 },
    { label: '100K', value: 100_000 },
    { label: '200K', value: 200_000 },
    { label: '500K', value: 500_000 },
    { label: '1M+', value: 1_000_000 },
];

const UNIT_PRICES = {
    api: 0.001,
    signup: 0.01,
    kyc: 0.1,
};

// Estimate cost at each tier for the Pro plan
// Base: $50/mo for 20K included API calls
function estimateProPrice(volume: number): number | null {
    if (volume >= 1_000_000) return null; // Custom
    const included = 20_000;
    const overage = Math.max(0, volume - included);
    return 50 + overage * UNIT_PRICES.api;
}

export default function PricingPage() {
    const [tierIndex, setTierIndex] = useState(0);
    const tier = TIERS[tierIndex];
    const isCustom = tier.value >= 1_000_000;
    const proPrice = useMemo(() => estimateProPrice(tier.value), [tier.value]);

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
                {/* ─── Header ───────────────────────────────────── */}
                <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                    <h1 style={{ fontSize: '48px', fontWeight: 800, letterSpacing: '-0.03em' }}>
                        Choose <span className="gradient-text">your</span> plan
                    </h1>
                    <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginTop: '12px' }}>
                        Select your number of <strong style={{ color: 'var(--text-primary)', textDecoration: 'underline', textUnderlineOffset: '4px' }}>monthly identifications</strong>
                    </p>
                </div>

                {/* ─── Slider ───────────────────────────────────── */}
                <div style={{ maxWidth: '600px', margin: '0 auto 56px', padding: '0 16px' }}>
                    <input
                        type="range"
                        min={0}
                        max={TIERS.length - 1}
                        step={1}
                        value={tierIndex}
                        onChange={e => setTierIndex(Number(e.target.value))}
                        style={{
                            width: '100%',
                            height: '6px',
                            appearance: 'none',
                            WebkitAppearance: 'none',
                            background: `linear-gradient(to right, var(--accent) ${(tierIndex / (TIERS.length - 1)) * 100}%, var(--line) ${(tierIndex / (TIERS.length - 1)) * 100}%)`,
                            borderRadius: '8px',
                            outline: 'none',
                            cursor: 'pointer',
                        }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                        {TIERS.map((t, i) => (
                            <button
                                key={t.label}
                                onClick={() => setTierIndex(i)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: i === tierIndex ? 'var(--text-primary)' : 'var(--text-muted)',
                                    fontWeight: i === tierIndex ? 700 : 500,
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    padding: '4px 2px',
                                    fontFamily: 'inherit',
                                    transition: 'color 0.2s',
                                }}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ─── Plan Cards ────────────────────────────────── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '64px' }}>
                    {/* ── Free ──────────────────────────────────── */}
                    <div className="glass-card" style={{ padding: '32px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '22px', fontWeight: 700 }}>Free</span>
                            <span style={{
                                fontSize: '11px', fontWeight: 700,
                                background: 'var(--accent-soft)',
                                color: 'var(--accent)',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                letterSpacing: '0.5px',
                            }}>NEW</span>
                        </div>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                            Web and mobile fraud detection.
                        </p>
                        <div style={{ marginBottom: '4px' }}>
                            <span style={{ fontSize: '42px', fontWeight: 800 }}>$0</span>
                            <span style={{ fontSize: '15px', color: 'var(--text-muted)' }}> /month</span>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
                            up to 1,000 API calls per month
                        </p>

                        <a href="/register" className="btn btn-sm" style={{
                            width: '100%', textAlign: 'center', display: 'block',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-medium)',
                            color: 'var(--text-primary)',
                            fontWeight: 600,
                            marginBottom: '28px',
                        }}>
                            Start Free
                        </a>

                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '14px' }}>Includes:</div>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '2.2' }}>
                            {[
                                '14 day free trial of Pro plan',
                                'Email & IP intelligence',
                                'Device fingerprinting',
                                'Basic risk scoring',
                                'Dashboard analytics',
                                'Community support',
                            ].map(f => (
                                <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: 'var(--accent)' }}>✓</span> {f}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* ── Pro ───────────────────────────────────── */}
                    <div className="glass-card" style={{
                        padding: '32px',
                        border: '2px solid var(--accent)',
                        position: 'relative',
                    }}>
                        <div style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>
                            Pro <span style={{ color: 'var(--accent)' }}>Plus</span>
                        </div>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                            Everything you need starting at
                        </p>

                        {isCustom ? (
                            <>
                                <div style={{ marginBottom: '4px' }}>
                                    <span style={{ fontSize: '42px', fontWeight: 800 }}>Custom</span>
                                </div>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
                                    tailored to your volume
                                </p>
                            </>
                        ) : (
                            <>
                                <div style={{ marginBottom: '4px' }}>
                                    <span style={{ fontSize: '42px', fontWeight: 800, color: 'var(--accent)' }}>
                                        ${proPrice?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </span>
                                    <span style={{ fontSize: '15px', color: 'var(--text-muted)' }}> /month for </span>
                                    <strong style={{ color: 'var(--text-primary)' }}>{tier.label}</strong>
                                    <span style={{ fontSize: '15px', color: 'var(--text-muted)' }}> API calls</span>
                                </div>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
                                    then usage-based pricing per service
                                </p>
                            </>
                        )}

                        <a href="/register" className="btn btn-primary btn-sm" style={{
                            width: '100%', textAlign: 'center', display: 'block',
                            background: 'var(--accent)',
                            borderColor: 'var(--accent)',
                            fontWeight: 600,
                            marginBottom: '28px',
                        }}>
                            {isCustom ? 'Contact Sales' : 'Start Free'}
                        </a>

                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '14px' }}>Includes:</div>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '2.2' }}>
                            {[
                                'Everything in Free',
                                'Full risk scoring engine',
                                'OAuth ghost detection',
                                'Stripe card fingerprinting',
                                'Graph analysis & clustering',
                                'Content fingerprinting',
                                'Post-signup monitoring',
                                'Priority support',
                            ].map(f => (
                                <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: 'var(--accent)' }}>✓</span> {f}
                                </li>
                            ))}
                        </ul>

                        {/* Per-unit pricing breakdown */}
                        <div style={{
                            marginTop: '20px',
                            padding: '16px',
                            background: 'rgba(16, 185, 129, 0.06)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--accent-soft)',
                        }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Per-unit pricing
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '2' }}>
                                <div><strong style={{ color: 'var(--text-primary)' }}>$0.001</strong> per API consultation</div>
                                <div><strong style={{ color: 'var(--text-primary)' }}>$0.01</strong> per sign-up evaluation</div>
                                <div><strong style={{ color: 'var(--text-primary)' }}>$0.10</strong> per KYC verification</div>
                            </div>
                        </div>
                    </div>

                    {/* ── Enterprise ────────────────────────────── */}
                    <div className="glass-card" style={{ padding: '32px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '22px', fontWeight: 700, color: '#8b5cf6', marginBottom: '8px' }}>
                            Enterprise
                        </div>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                            Build your own plan.
                        </p>
                        <div style={{ marginBottom: '4px' }}>
                            <span style={{ fontSize: '42px', fontWeight: 800 }}>Custom</span>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
                            &nbsp;
                        </p>

                        <a href="mailto:tomascorzo1203@gmail.com" className="btn btn-sm" style={{
                            width: '100%', textAlign: 'center', display: 'block',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid rgba(139, 92, 246, 0.4)',
                            color: '#8b5cf6',
                            fontWeight: 600,
                            marginBottom: '28px',
                        }}>
                            Contact Sales
                        </a>

                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '14px' }}>Customize your plan:</div>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '2.2' }}>
                            {[
                                'Everything in Pro Plus',
                                'Dedicated infrastructure',
                                'Custom rules engine',
                                'Volume discounts',
                                '99.99% SLA guarantee',
                                'Slack & webhook integrations',
                                'Compliance module (GDPR/CCPA)',
                                'Dedicated account manager',
                            ].map(f => (
                                <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: '#8b5cf6' }}>✓</span> {f}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* ─── Unit Pricing Table ────────────────────────── */}
                <div style={{ maxWidth: '700px', margin: '0 auto 64px' }}>
                    <h2 style={{ fontSize: '28px', fontWeight: 800, textAlign: 'center', marginBottom: '12px' }}>
                        Pay only for what you <span className="gradient-text">use</span>
                    </h2>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '32px' }}>
                        All plans include a base of 20K API calls. Additional usage is billed per unit.
                    </p>

                    <div className="glass-card" style={{ overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <th style={{ textAlign: 'left', padding: '16px 20px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Service</th>
                                    <th style={{ textAlign: 'right', padding: '16px 20px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Per Unit</th>
                                    <th style={{ textAlign: 'right', padding: '16px 20px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Per 1,000</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { name: 'API Consultation', icon: '🔍', unit: '$0.001', per1k: '$1.00' },
                                    { name: 'Sign-up Evaluation', icon: '🛡️', unit: '$0.01', per1k: '$10.00' },
                                    { name: 'KYC Verification', icon: '🪪', unit: '$0.10', per1k: '$100.00' },
                                ].map((row, i) => (
                                    <tr key={row.name} style={{ borderBottom: i < 2 ? '1px solid var(--border-subtle)' : 'none' }}>
                                        <td style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span>{row.icon}</span>
                                            <span style={{ fontWeight: 600 }}>{row.name}</span>
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '16px 20px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent)', fontWeight: 600 }}>{row.unit}</td>
                                        <td style={{ textAlign: 'right', padding: '16px 20px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-secondary)' }}>{row.per1k}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ─── FAQ ───────────────────────────────────────── */}
                <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                    <h2 style={{ fontSize: '28px', fontWeight: 800, textAlign: 'center', marginBottom: '32px' }}>
                        Frequently Asked Questions
                    </h2>
                    {[
                        { q: 'What counts as an "API consultation"?', a: 'Each call to any TrialShield API endpoint (risk scoring, device fingerprinting, etc.) counts as one consultation. Cached results within the same session are not double-counted.' },
                        { q: 'How does the sign-up evaluation pricing work?', a: 'Each unique user evaluation through the /verify endpoint counts as one sign-up evaluation. This includes email, IP, and device intelligence analysis.' },
                        { q: 'What\'s included in a KYC verification?', a: 'A full KYC verification includes document OCR, face matching, liveness detection, and risk scoring — all processed client-side for maximum privacy.' },
                        { q: 'Can I switch plans at any time?', a: 'Yes. Upgrades take effect immediately. Downgrades apply at the end of your current billing cycle.' },
                        { q: 'What payment methods do you accept?', a: 'We accept all major credit cards and debit cards through our payment processor Creem.' },
                        { q: 'Do you offer volume discounts?', a: 'Yes. Enterprise plans include custom volume pricing. Contact us to discuss your needs.' },
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

            {/* ─── Slider Thumb Styles ──────────────────────────── */}
            <style>{`
                input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: var(--accent);
                    cursor: pointer;
                    border: 3px solid #0a2a1f;
                    box-shadow: 0 0 12px rgba(16, 185, 129, 0.4);
                    transition: box-shadow 0.2s;
                }
                input[type="range"]::-webkit-slider-thumb:hover {
                    box-shadow: 0 0 20px rgba(16, 185, 129, 0.6);
                }
                input[type="range"]::-moz-range-thumb {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: var(--accent);
                    cursor: pointer;
                    border: 3px solid #0a2a1f;
                    box-shadow: 0 0 12px rgba(16, 185, 129, 0.4);
                }
                @media (max-width: 768px) {
                    div[style*="grid-template-columns: repeat(3"] {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </>
    );
}
