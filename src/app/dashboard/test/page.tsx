'use client';

import { useState } from 'react';

export default function TestAPIPage() {
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [ip, setIp] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');

    async function runTest() {
        if (!email && !phone && !ip) {
            setError('Please provide at least an email, phone, or IP address.');
            return;
        }

        setLoading(true);
        setError('');
        setResult(null);

        try {
            const startTime = Date.now();
            const res = await fetch('/api/v1/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': process.env.NEXT_PUBLIC_TRIALSHIELD_TEST_KEY || 'test-mode',
                },
                body: JSON.stringify({
                    email: email || undefined,
                    phone: phone || undefined,
                    ip: ip || undefined,
                }),
            });

            const data = await res.json();
            data._clientLatency = Date.now() - startTime;
            setResult(data);
        } catch (err: any) {
            setError(err.message || 'Request failed');
        } finally {
            setLoading(false);
        }
    }

    function loadPreset(type: string) {
        switch (type) {
            case 'clean':
                setEmail('john.doe@gmail.com');
                setPhone('+14155551234');
                setIp('8.8.8.8');
                break;
            case 'disposable':
                setEmail('test@tempmail.com');
                setPhone('');
                setIp('');
                break;
            case 'suspicious':
                setEmail('xkzjv82@yopmail.com');
                setPhone('+16505551234');
                setIp('');
                break;
            case 'voip':
                setEmail('user@gmail.com');
                setPhone('+18005551234');
                setIp('');
                break;
        }
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1>🧪 Test API</h1>
                    <p>Run a verification request and see the full risk analysis</p>
                </div>
            </div>

            {/* ─── Preset Buttons ──────────────────────────────── */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => loadPreset('clean')}>
                    ✅ Clean User
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => loadPreset('disposable')}>
                    🗑️ Disposable Email
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => loadPreset('suspicious')}>
                    ⚠️ Suspicious User
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => loadPreset('voip')}>
                    📞 VOIP Number
                </button>
            </div>

            {/* ─── Input Form ──────────────────────────────────── */}
            <div className="glass-card" style={{ padding: '32px', marginBottom: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                            Email Address
                        </label>
                        <input
                            type="email"
                            placeholder="user@example.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                            Phone Number
                        </label>
                        <input
                            type="text"
                            placeholder="+1234567890"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                            IP Address
                        </label>
                        <input
                            type="text"
                            placeholder="203.0.113.42"
                            value={ip}
                            onChange={e => setIp(e.target.value)}
                        />
                    </div>
                </div>

                <button
                    className="btn btn-primary"
                    onClick={runTest}
                    disabled={loading}
                    style={{ opacity: loading ? 0.6 : 1 }}
                >
                    {loading ? (
                        <>
                            <span className="loading-spinner"></span> Analyzing...
                        </>
                    ) : (
                        '🔍 Run Verification'
                    )}
                </button>

                {error && (
                    <div style={{ marginTop: '16px', padding: '12px', background: 'var(--color-deny-bg)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: 'var(--color-deny)', fontSize: '14px' }}>
                        {error}
                    </div>
                )}
            </div>

            {/* ─── Results ─────────────────────────────────────── */}
            {result && (
                <div className="animate-scale-in">
                    {/* Decision Header */}
                    <div className="glass-card" style={{ padding: '32px', marginBottom: '24px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
                            <div>
                                <div style={{ fontSize: '48px', marginBottom: '8px' }}>
                                    {result.decision === 'ALLOW' ? '✅' : result.decision === 'CHALLENGE' ? '⚠️' : '🚫'}
                                </div>
                                <span className={`badge badge-${result.decision?.toLowerCase()}`} style={{ fontSize: '16px', padding: '8px 20px' }}>
                                    {result.decision}
                                </span>
                            </div>
                            <div>
                                <div className={`score-indicator ${result.riskScore <= 30 ? 'score-low' : result.riskScore <= 70 ? 'score-medium' : 'score-high'}`}
                                    style={{ width: '80px', height: '80px', fontSize: '24px' }}>
                                    {result.riskScore}
                                </div>
                                <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>Risk Score</div>
                            </div>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Processing Time</div>
                                <div style={{ fontSize: '20px', fontWeight: 700 }}>{result.processingTimeMs}ms</div>
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Signals: {result.signals?.length || 0}</div>
                            </div>
                        </div>
                    </div>

                    {/* Score Breakdown */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginBottom: '24px' }}>
                        {result.breakdown && Object.entries(result.breakdown as Record<string, unknown>)
                            .filter(([key]) => key.endsWith('Score') && key !== 'finalScore')
                            .map(([key, value]) => (
                                <div key={key} className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                                        {key.replace('Score', '')}
                                    </div>
                                    <div className={`score-indicator ${(value as number) <= 30 ? 'score-low' : (value as number) <= 70 ? 'score-medium' : 'score-high'}`}
                                        style={{ margin: '0 auto' }}>
                                        {value as number}
                                    </div>
                                </div>
                            ))}
                    </div>

                    {/* Signals */}
                    <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>
                            🚨 Risk Signals ({result.signals?.length || 0})
                        </h3>
                        {result.signals?.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)' }}>No risk signals detected — user appears legitimate.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {result.signals?.map((signal: any, i: number) => (
                                    <div key={i} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px 16px',
                                        background: 'var(--bg-secondary)',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-subtle)',
                                    }}>
                                        <span className={`badge badge-${signal.severity === 'CRITICAL' || signal.severity === 'HIGH' ? 'deny' : signal.severity === 'MEDIUM' ? 'challenge' : 'allow'}`}>
                                            {signal.severity}
                                        </span>
                                        <span className="signal-tag" style={{
                                            fontFamily: 'JetBrains Mono',
                                            background: 'var(--bg-tertiary)',
                                            border: '1px solid var(--border-subtle)',
                                        }}>
                                            {signal.signal}
                                        </span>
                                        <span style={{ fontSize: '14px', color: 'var(--text-secondary)', flex: 1 }}>
                                            {signal.description}
                                        </span>
                                        {signal.value !== undefined && (
                                            <span style={{ fontSize: '13px', fontFamily: 'JetBrains Mono', color: 'var(--text-muted)' }}>
                                                {String(signal.value)}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Raw JSON */}
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>📋 Raw API Response</h3>
                        <div className="code-block">
                            <div className="code-header">
                                <div className="code-dot red"></div>
                                <div className="code-dot yellow"></div>
                                <div className="code-dot green"></div>
                                <span className="code-title">response.json</span>
                            </div>
                            <div className="code-body">
                                <pre style={{ fontSize: '12px', maxHeight: '400px', overflowY: 'auto' }}>
                                    {JSON.stringify(result, null, 2)}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
