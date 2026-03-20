'use client';

import { useState, useEffect } from 'react';

interface StripeConfig {
    configured: boolean;
    is_active?: boolean;
    events_listening?: string[];
    updated_at?: string;
    total_events_received?: number;
}

const STRIPE_EVENTS = [
    { id: 'charge.succeeded', label: 'Charge Succeeded', icon: '✅', description: 'When a payment charge completes — extracts card fingerprint, BIN, brand, country' },
    { id: 'charge.failed', label: 'Charge Failed', icon: '❌', description: 'When a payment fails — CVC/AVS failures detected' },
    { id: 'payment_intent.succeeded', label: 'Payment Intent Succeeded', icon: '💰', description: 'When a PaymentIntent completes — full card data extraction' },
    { id: 'payment_method.attached', label: 'Payment Method Attached', icon: '💳', description: 'When a card is saved to a customer — fingerprint stored before any charge' },
    { id: 'customer.created', label: 'Customer Created', icon: '👤', description: 'When a Stripe customer is created — links Stripe ID to TrialShield user' },
    { id: 'setup_intent.succeeded', label: 'Setup Intent Succeeded', icon: '🔧', description: 'When a card is set up for future payments — early fingerprint capture' },
];

export default function StripePage() {
    const [config, setConfig] = useState<StripeConfig>({ configured: false });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [form, setForm] = useState({
        webhookSecret: '',
        stripeSecretKey: '',
    });

    const apiKey = typeof window !== 'undefined'
        ? (process.env.NEXT_PUBLIC_TRIALSHIELD_TEST_KEY || 'master')
        : 'master';

    const webhookUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/api/v1/stripe/webhook`
        : '';

    useEffect(() => { fetchConfig(); }, []);

    async function fetchConfig() {
        try {
            const res = await fetch('/api/v1/stripe/config', {
                headers: { 'X-API-Key': apiKey },
            });
            const data = await res.json();
            setConfig(data);
        } catch { }
        finally { setLoading(false); }
    }

    async function saveConfig() {
        if (!form.webhookSecret) return;
        setSaving(true);
        try {
            const res = await fetch('/api/v1/stripe/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey,
                },
                body: JSON.stringify(form),
            });
            if (res.ok) {
                setSuccessMessage('Stripe configured successfully!');
                setTimeout(() => setSuccessMessage(''), 4000);
                fetchConfig();
                setForm({ webhookSecret: '', stripeSecretKey: '' });
            }
        } catch { }
        finally { setSaving(false); }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                <div className="loading-spinner" style={{ width: '40px', height: '40px' }}></div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1>💳 Stripe Integration</h1>
                    <p>Card fingerprinting via Stripe webhooks</p>
                </div>
            </div>

            {successMessage && (
                <div style={{
                    padding: '14px 20px', marginBottom: '24px',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: '12px', color: 'var(--color-allow)',
                    fontSize: '14px', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                    ✅ {successMessage}
                </div>
            )}

            {/* How it works */}
            <div className="glass-card" style={{
                padding: '20px 24px', marginBottom: '24px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.06), rgba(168, 85, 247, 0.06))',
                border: '1px solid rgba(99, 102, 241, 0.15)',
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    <span style={{ fontSize: '28px' }}>⚡</span>
                    <div>
                        <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>
                            How Stripe Card Fingerprinting Works
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                            <strong>1.</strong> Add your Stripe webhook secret below<br />
                            <strong>2.</strong> Add the Webhook URL to your Stripe Dashboard<br />
                            <strong>3.</strong> When users make payments, Stripe sends events to TrialShield<br />
                            <strong>4.</strong> TrialShield extracts card fingerprint, BIN, prepaid status, and risk signals<br />
                            <strong>5.</strong> If the same card appears across multiple accounts → <strong>trial abuse detected</strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Stripe Card */}
            <div className="glass-card" style={{
                padding: 0, overflow: 'hidden',
                border: config.configured
                    ? '1px solid rgba(99, 102, 241, 0.3)'
                    : '1px solid var(--border-subtle)',
            }}>
                {/* Header */}
                <div
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '20px 24px', cursor: 'pointer',
                    }}
                    onClick={() => setExpanded(!expanded)}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '12px',
                            background: 'rgba(99, 102, 241, 0.08)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '1px solid rgba(99, 102, 241, 0.2)',
                        }}>
                            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                                <rect x="2" y="6" width="24" height="16" rx="3" stroke="#635BFF" strokeWidth="2" />
                                <rect x="2" y="10" width="24" height="4" fill="#635BFF" opacity="0.3" />
                                <rect x="6" y="17" width="6" height="2" rx="1" fill="#635BFF" />
                                <rect x="16" y="17" width="4" height="2" rx="1" fill="#635BFF" opacity="0.4" />
                            </svg>
                        </div>
                        <div>
                            <div style={{ fontSize: '16px', fontWeight: 700 }}>Stripe</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                {config.configured
                                    ? `Active — ${config.total_events_received || 0} events received`
                                    : 'Not configured'}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {config.configured && (
                            <span className="badge badge-allow" style={{ fontSize: '12px' }}>Active</span>
                        )}
                        <div style={{
                            width: '44px', height: '24px', borderRadius: '12px',
                            background: config.configured ? 'var(--color-allow)' : 'var(--bg-tertiary)',
                            position: 'relative', cursor: 'pointer',
                            transition: 'background 0.3s',
                        }}
                            onClick={(e) => { e.stopPropagation(); if (!config.configured) setExpanded(true); }}
                        >
                            <div style={{
                                width: '18px', height: '18px', borderRadius: '50%',
                                background: 'white', position: 'absolute', top: '3px',
                                left: config.configured ? '23px' : '3px',
                                transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            }} />
                        </div>
                        <span style={{
                            fontSize: '14px', color: 'var(--text-muted)',
                            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.3s',
                        }}>▼</span>
                    </div>
                </div>

                {/* Expanded panel */}
                {expanded && (
                    <div style={{
                        padding: '0 24px 24px',
                        borderTop: '1px solid var(--border-subtle)',
                        animation: 'fadeIn 0.3s ease',
                    }}>
                        {/* Setup steps */}
                        <div style={{
                            padding: '16px', marginTop: '16px',
                            background: 'var(--bg-secondary)', borderRadius: '10px',
                            marginBottom: '20px', border: '1px solid var(--border-subtle)',
                        }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                📝 Quick Setup
                                <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener"
                                    style={{ fontSize: '12px', color: '#635BFF', fontWeight: 500, textDecoration: 'none' }}>
                                    Open Stripe Dashboard ↗
                                </a>
                            </div>
                            <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '2' }}>
                                <li>Go to the Stripe Dashboard → Developers → Webhooks</li>
                                <li>Click &quot;Add endpoint&quot; and paste the Webhook URL below</li>
                                <li>Select the events listed below (or &quot;All events&quot;)</li>
                                <li>Copy the Signing Secret (starts with <code style={{ fontSize: '12px', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>whsec_</code>) and paste it here</li>
                            </ol>
                        </div>

                        {/* Webhook URL */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                                Webhook URL <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(add this to Stripe)</span>
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input type="text" value={webhookUrl} readOnly
                                    style={{ flex: 1, background: 'var(--bg-tertiary)', fontFamily: 'monospace', fontSize: '13px' }} />
                                <button className="btn btn-sm"
                                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', fontSize: '12px', padding: '8px 12px', whiteSpace: 'nowrap' }}
                                    onClick={() => navigator.clipboard.writeText(webhookUrl)}>
                                    📋 Copy
                                </button>
                            </div>
                        </div>

                        {/* Form */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                            <div>
                                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                                    Webhook Signing Secret
                                </label>
                                <input
                                    type="password"
                                    placeholder={config.configured ? '••••••••••••••••' : 'whsec_xxxxxxxxxxxxxxx'}
                                    value={form.webhookSecret}
                                    onChange={e => setForm(prev => ({ ...prev, webhookSecret: e.target.value }))}
                                    style={{ width: '100%', fontFamily: 'monospace', fontSize: '13px' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                                    Stripe Secret Key <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional — for enrichment)</span>
                                </label>
                                <input
                                    type="password"
                                    placeholder={config.configured ? '••••••••••••••••' : 'sk_live_xxxxxxxxxxxxxxx'}
                                    value={form.stripeSecretKey}
                                    onChange={e => setForm(prev => ({ ...prev, stripeSecretKey: e.target.value }))}
                                    style={{ width: '100%', fontFamily: 'monospace', fontSize: '13px' }}
                                />
                            </div>
                        </div>

                        {/* Events */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                                Events Monitored <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(select these in Stripe)</span>
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {STRIPE_EVENTS.map(evt => (
                                    <div key={evt.id} style={{
                                        padding: '10px 14px',
                                        background: 'var(--bg-secondary)',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-subtle)',
                                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                                    }}>
                                        <span style={{ fontSize: '16px', marginTop: '1px' }}>{evt.icon}</span>
                                        <div>
                                            <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'monospace' }}>{evt.id}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{evt.description}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Save */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {config.updated_at
                                    ? `Last updated: ${new Date(config.updated_at).toLocaleString()}`
                                    : 'Not configured yet'}
                            </div>
                            <button className="btn btn-primary btn-sm" onClick={saveConfig}
                                disabled={saving || !form.webhookSecret}
                                style={{
                                    opacity: !form.webhookSecret ? 0.5 : 1,
                                    cursor: !form.webhookSecret ? 'not-allowed' : 'pointer',
                                    padding: '10px 20px',
                                }}>
                                {saving ? '⏳ Saving...' : config.configured ? '💾 Update Configuration' : '✅ Enable Stripe'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* What TrialShield detects */}
            <div className="glass-card" style={{ padding: '24px', marginTop: '24px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '20px' }}>🧠 What TrialShield Detects from Stripe</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    {[
                        { icon: '🔑', label: 'Card Fingerprint Reuse', desc: 'Same card across multiple accounts → definite duplicate', severity: 'CRITICAL' },
                        { icon: '💳', label: 'Prepaid/Gift Cards', desc: 'Prepaid funding type = common for trial abuse', severity: 'HIGH' },
                        { icon: '🔢', label: 'BIN Clustering', desc: 'Same card BIN across 3+ accounts → organized abuse', severity: 'HIGH' },
                        { icon: '🚨', label: 'Stripe Radar Risk', desc: 'Elevated/highest Stripe risk = additional penalty', severity: 'HIGH' },
                        { icon: '❌', label: 'CVC/AVS Failures', desc: 'Failed verification checks = potential fraud', severity: 'MEDIUM' },
                        { icon: '🌍', label: 'Country Mismatch', desc: 'Card country ≠ billing country → suspicious', severity: 'MEDIUM' },
                        { icon: '💸', label: 'Low-Amount Testing', desc: 'Sub-$1 charges → card testing behavior', severity: 'MEDIUM' },
                        { icon: '🔗', label: 'Cross-Signal Fusion', desc: 'Card data feeds into graph + 25 risk rules', severity: 'CRITICAL' },
                        { icon: '🧬', label: 'Identity Anchoring', desc: 'Card fingerprint stored as identity anchor', severity: 'LOW' },
                    ].map(item => (
                        <div key={item.label} style={{
                            padding: '14px',
                            background: 'var(--bg-secondary)',
                            borderRadius: '10px',
                            border: '1px solid var(--border-subtle)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                <span style={{ fontSize: '18px' }}>{item.icon}</span>
                                <span style={{ fontSize: '13px', fontWeight: 700 }}>{item.label}</span>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>{item.desc}</div>
                            <span className={`signal-tag ${item.severity.toLowerCase()}`} style={{ fontSize: '10px', marginTop: '6px', display: 'inline-block' }}>
                                {item.severity}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
