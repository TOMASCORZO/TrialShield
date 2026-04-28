'use client';

// Live event-stream + risk panel mock that animates a pointer through the
// rows. Mirrors the design bundle's HeroVisual component.

import { useEffect, useState } from 'react';

const EVENTS = [
    { id: 'evt_8a2f', country: 'US', risk: 'low', score: 4, vpn: false, label: 'Trial signup' },
    { id: 'evt_9c3d', country: 'NL', risk: 'high', score: 87, vpn: true, label: 'Trial signup' },
    { id: 'evt_1b4e', country: 'BR', risk: 'low', score: 12, vpn: false, label: 'Login' },
    { id: 'evt_7d2a', country: 'RU', risk: 'med', score: 64, vpn: true, label: 'Trial signup' },
    { id: 'evt_3f1c', country: 'DE', risk: 'low', score: 8, vpn: false, label: 'Checkout' },
];

export default function HeroVisual() {
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick(t => t + 1), 1800);
        return () => clearInterval(id);
    }, []);

    return (
        <div style={{
            position: 'relative',
            borderRadius: 16,
            border: '1px solid var(--line)',
            background: 'var(--bg-elev)',
            boxShadow: '0 16px 40px -8px rgba(10, 14, 26, 0.12), 0 4px 12px -2px rgba(10, 14, 26, 0.06)',
            overflow: 'hidden',
        }}>
            {/* Mini app chrome */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderBottom: '1px solid var(--line)',
                background: 'var(--bg-sunken)',
            }}>
                <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: '#E5E7EB' }} />
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: '#E5E7EB' }} />
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: '#E5E7EB' }} />
                </div>
                <div className="t-mono" style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                    app.trialshield.cc / events
                </div>
                <div style={{ width: 28 }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px' }}>
                {/* Event stream */}
                <div style={{ padding: '16px 16px 16px 20px', borderRight: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="dot dot-blue pulse-dot" />
                            <span style={{ fontSize: 13, fontWeight: 500 }}>Live event stream</span>
                        </div>
                        <span className="t-mono" style={{ fontSize: 11, color: 'var(--ink-4)' }}>14,238 / hour</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {EVENTS.map((e, i) => {
                            const active = i === (tick % EVENTS.length);
                            const dotClass = e.risk === 'high' ? 'dot-red' : e.risk === 'med' ? 'dot-amber' : 'dot-green';
                            return (
                                <div key={e.id} style={{
                                    display: 'grid',
                                    gridTemplateColumns: '14px 90px 1fr 70px 50px',
                                    alignItems: 'center', gap: 12,
                                    padding: '10px 12px',
                                    background: active ? 'var(--accent-soft)' : 'transparent',
                                    border: `1px solid ${active ? 'var(--accent-line)' : 'transparent'}`,
                                    borderRadius: 8,
                                    transition: 'all 300ms ease',
                                    fontSize: 12,
                                }}>
                                    <span className={`dot ${dotClass}`} />
                                    <span className="t-mono" style={{ color: 'var(--ink-3)' }}>{e.id}</span>
                                    <span style={{ color: 'var(--ink-2)' }}>{e.label}</span>
                                    <span className="t-mono" style={{ color: 'var(--ink-3)', fontSize: 11 }}>
                                        {e.country} {e.vpn && <span style={{ color: 'var(--amber)' }}>· VPN</span>}
                                    </span>
                                    <span className="t-mono" style={{
                                        textAlign: 'right',
                                        color: e.risk === 'high' ? 'var(--red)' : e.risk === 'med' ? 'var(--amber)' : 'var(--green)',
                                        fontWeight: 600,
                                    }}>{e.score}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Risk panel */}
                <div style={{ padding: 18 }}>
                    <div className="t-eyebrow" style={{ marginBottom: 12 }}>Selected event</div>
                    <div className="t-mono" style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 18 }}>
                        evt_9c3d8f
                    </div>
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 36, fontWeight: 500, color: 'var(--red)', letterSpacing: '-0.03em', fontFamily: 'var(--font-mono)' }}>87</span>
                            <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>/ 100</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Risk score</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[
                            { l: 'Device fingerprint', v: 'Reused (3×)', bad: true },
                            { l: 'Network', v: 'Datacenter VPN', bad: true },
                            { l: 'Account cluster', v: '7 linked', bad: true },
                            { l: 'Browser integrity', v: 'Headless', bad: true },
                        ].map(r => (
                            <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, paddingBottom: 8, borderBottom: '1px dashed var(--line)' }}>
                                <span style={{ color: 'var(--ink-3)' }}>{r.l}</span>
                                <span style={{ color: r.bad ? 'var(--red)' : 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{r.v}</span>
                            </div>
                        ))}
                    </div>
                    <button className="btn btn-accent btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 18 }}>
                        Block account
                    </button>
                </div>
            </div>
        </div>
    );
}
