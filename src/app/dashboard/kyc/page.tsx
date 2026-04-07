'use client';

import { useState, useEffect } from 'react';

interface KycResult {
    verified?: boolean;
    decision?: string;
    riskScore?: number;
    signals?: Array<{ signal: string; severity: string; description: string }>;
    level?: string;
    document?: {
        ocrExtracted?: boolean;
        mrzValid?: boolean;
        data?: Record<string, string>;
        mrzData?: Record<string, unknown>;
    };
    face?: {
        matchScore?: number;
        faceOnDocument?: boolean;
        faceOnSelfie?: boolean;
    };
    liveness?: {
        passed?: boolean;
        blinkDetected?: boolean;
    };
}

interface KycSession {
    id: string;
    external_user_id: string;
    status: string;
    verification_level?: string;
    result?: KycResult;
    created_at: string;
    completed_at?: string;
    expires_at: string;
}

export default function KycDashboardPage() {
    const [sessions, setSessions] = useState<KycSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newUserId, setNewUserId] = useState('');
    const [newRedirectUrl, setNewRedirectUrl] = useState('');
    const [newLevel, setNewLevel] = useState('document_face');
    const [createdUrl, setCreatedUrl] = useState('');
    const [filter, setFilter] = useState('all');
    const [selectedSession, setSelectedSession] = useState<KycSession | null>(null);

    const apiKey = typeof window !== 'undefined'
        ? (process.env.NEXT_PUBLIC_TRIALSHIELD_TEST_KEY || 'master') : 'master';

    useEffect(() => { fetchSessions(); }, []);

    async function fetchSessions() {
        try {
            const url = '/api/v1/kyc/session' + (filter !== 'all' ? `?status=${filter}` : '');
            const res = await fetch(url, { headers: { 'X-API-Key': apiKey } });
            const data = await res.json();
            setSessions(data.sessions || []);
        } catch { }
        finally { setLoading(false); }
    }

    useEffect(() => { setLoading(true); fetchSessions(); }, [filter]);

    async function createSession() {
        if (!newUserId.trim()) return;
        setCreating(true);
        setCreatedUrl('');
        try {
            const res = await fetch('/api/v1/kyc/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
                body: JSON.stringify({
                    userId: newUserId.trim(),
                    redirectUrl: newRedirectUrl.trim() || undefined,
                    level: newLevel,
                }),
            });
            const data = await res.json();
            if (data.verifyUrl) {
                setCreatedUrl(data.verifyUrl);
                setNewUserId('');
                setNewRedirectUrl('');
                fetchSessions();
            }
        } catch { }
        finally { setCreating(false); }
    }

    const statusBadge = (status: string, result?: KycResult) => {
        const map: Record<string, { bg: string; color: string; label: string }> = {
            pending: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', label: 'Pending' },
            expired: { bg: 'rgba(113,113,122,0.1)', color: '#71717a', label: 'Expired' },
        };
        if (status === 'completed') {
            const d = result?.decision;
            if (d === 'VERIFIED') return <span style={{ ...badgeStyle, background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>VERIFIED</span>;
            if (d === 'REVIEW') return <span style={{ ...badgeStyle, background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>REVIEW</span>;
            return <span style={{ ...badgeStyle, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>REJECTED</span>;
        }
        const c = map[status] || map.pending;
        return <span style={{ ...badgeStyle, background: c.bg, color: c.color }}>{c.label}</span>;
    };

    const badgeStyle: React.CSSProperties = {
        padding: '4px 10px', borderRadius: '6px',
        fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
    };

    const levelBadge = (level?: string) => {
        const colors: Record<string, string> = { document_only: '#6366f1', document_face: '#8b5cf6', full: '#ec4899' };
        return (
            <span style={{ ...badgeStyle, background: `${colors[level || 'document_face']}15`, color: colors[level || 'document_face'] }}>
                {(level || 'document_face').replace(/_/g, ' ')}
            </span>
        );
    };

    if (loading) {
        return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><div className="loading-spinner" style={{ width: '40px', height: '40px' }}></div></div>;
    }

    const verifiedCount = sessions.filter(s => s.result?.decision === 'VERIFIED').length;
    const rejectedCount = sessions.filter(s => s.result?.decision === 'REJECTED').length;
    const reviewCount = sessions.filter(s => s.result?.decision === 'REVIEW').length;
    const pendingCount = sessions.filter(s => s.status === 'pending').length;

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1>🪪 KYC Verification</h1>
                    <p>Identity verification sessions — document OCR, face matching, liveness detection</p>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
                {[
                    { label: 'Total', value: sessions.length, color: '#6366f1' },
                    { label: 'Verified', value: verifiedCount, color: '#10b981' },
                    { label: 'Review', value: reviewCount, color: '#f59e0b' },
                    { label: 'Rejected', value: rejectedCount, color: '#ef4444' },
                    { label: 'Pending', value: pendingCount, color: '#71717a' },
                ].map(s => (
                    <div key={s.label} className="glass-card" style={{ padding: '14px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Create Session */}
            <div className="glass-card" style={{
                padding: '24px', marginBottom: '24px',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(168,85,247,0.06))',
                border: '1px solid rgba(99,102,241,0.15)',
            }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Create Verification Session</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '12px', alignItems: 'end' }}>
                    <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px', color: 'var(--text-muted)' }}>USER ID *</label>
                        <input type="text" placeholder="user_abc123" value={newUserId} onChange={e => setNewUserId(e.target.value)} style={{ width: '100%', fontSize: '13px' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px', color: 'var(--text-muted)' }}>REDIRECT URL</label>
                        <input type="text" placeholder="https://your-app.com/callback" value={newRedirectUrl} onChange={e => setNewRedirectUrl(e.target.value)} style={{ width: '100%', fontSize: '13px' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px', color: 'var(--text-muted)' }}>LEVEL</label>
                        <select value={newLevel} onChange={e => setNewLevel(e.target.value)} style={{ fontSize: '13px', padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}>
                            <option value="document_only">Document Only</option>
                            <option value="document_face">Document + Face</option>
                            <option value="full">Full (+ Liveness)</option>
                        </select>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={createSession} disabled={creating || !newUserId.trim()} style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                        {creating ? 'Creating...' : '+ Create'}
                    </button>
                </div>

                {createdUrl && (
                    <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span>✅</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Verification URL:</div>
                            <code style={{ fontSize: '12px', color: 'var(--color-allow)', wordBreak: 'break-all' }}>{createdUrl}</code>
                        </div>
                        <button className="btn btn-sm" style={{ fontSize: '11px', padding: '6px 10px' }} onClick={() => navigator.clipboard.writeText(createdUrl)}>Copy</button>
                    </div>
                )}

                <div style={{ marginTop: '14px', padding: '10px 14px', background: 'var(--bg-primary)', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    POST /api/v1/kyc/session<br />
                    {`{ "userId": "user_123", "level": "document_face", "redirectUrl": "..." }`}<br />
                    <span style={{ color: 'var(--color-allow)' }}>{`→ { "sessionId": "...", "verifyUrl": "https://trialshield.cc/verify/..." }`}</span>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
                {['all', 'pending', 'completed', 'expired'].map(f => (
                    <button key={f} onClick={() => setFilter(f)} className="btn btn-sm" style={{
                        background: filter === f ? 'rgba(99,102,241,0.15)' : 'var(--bg-tertiary)',
                        color: filter === f ? '#6366f1' : 'var(--text-muted)',
                        border: filter === f ? '1px solid rgba(99,102,241,0.3)' : '1px solid var(--border-subtle)',
                        fontSize: '11px', padding: '5px 12px', textTransform: 'capitalize',
                    }}>{f}</button>
                ))}
            </div>

            {/* Sessions Table */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            {['User ID', 'Level', 'Status', 'Risk', 'Face Match', 'Signals', 'Created', ''].map(h => (
                                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sessions.length === 0 ? (
                            <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No sessions yet.</td></tr>
                        ) : sessions.map(s => (
                            <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)', cursor: s.status === 'completed' ? 'pointer' : 'default' }}
                                onClick={() => s.status === 'completed' && setSelectedSession(s)}>
                                <td style={{ padding: '10px 14px' }}><code style={{ fontSize: '12px' }}>{s.external_user_id}</code></td>
                                <td style={{ padding: '10px 14px' }}>{levelBadge(s.verification_level)}</td>
                                <td style={{ padding: '10px 14px' }}>{statusBadge(s.status, s.result)}</td>
                                <td style={{ padding: '10px 14px' }}>
                                    {s.result?.riskScore !== undefined ? (
                                        <span style={{ fontWeight: 700, color: s.result.riskScore > 50 ? '#ef4444' : s.result.riskScore > 20 ? '#f59e0b' : '#10b981' }}>{s.result.riskScore}</span>
                                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                    {s.result?.face?.matchScore !== undefined ? (
                                        <span style={{ fontSize: '12px', color: s.result.face.matchScore < 0.45 ? '#10b981' : s.result.face.matchScore < 0.6 ? '#f59e0b' : '#ef4444' }}>
                                            {((1 - s.result.face.matchScore) * 100).toFixed(0)}%
                                        </span>
                                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                    {s.result?.signals?.length ? (
                                        <span style={{ fontSize: '12px', color: '#ef4444' }}>{s.result.signals.length}</span>
                                    ) : s.status === 'completed' ? (
                                        <span style={{ fontSize: '12px', color: '#10b981' }}>0</span>
                                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                </td>
                                <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '12px' }}>{new Date(s.created_at).toLocaleDateString()}</td>
                                <td style={{ padding: '10px 14px' }}>
                                    {s.status === 'completed' && (
                                        <span style={{ fontSize: '11px', color: '#6366f1', fontWeight: 600 }}>Details →</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Detail Modal */}
            {selectedSession && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '24px' }}
                    onClick={() => setSelectedSession(null)}>
                    <div className="glass-card" style={{ maxWidth: '600px', width: '100%', padding: '28px', maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Verification Details</h3>
                            <button onClick={() => setSelectedSession(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '2px' }}>USER</div>
                                <div style={{ fontSize: '14px', fontWeight: 700 }}>{selectedSession.external_user_id}</div>
                            </div>
                            <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '2px' }}>DECISION</div>
                                <div style={{ fontSize: '14px', fontWeight: 700 }}>{statusBadge(selectedSession.status, selectedSession.result)}</div>
                            </div>
                            <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '2px' }}>RISK SCORE</div>
                                <div style={{ fontSize: '20px', fontWeight: 800, color: (selectedSession.result?.riskScore || 0) > 50 ? '#ef4444' : (selectedSession.result?.riskScore || 0) > 20 ? '#f59e0b' : '#10b981' }}>
                                    {selectedSession.result?.riskScore ?? '—'}
                                </div>
                            </div>
                            <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '2px' }}>LEVEL</div>
                                <div>{levelBadge(selectedSession.verification_level)}</div>
                            </div>
                        </div>

                        {/* Document data */}
                        {selectedSession.result?.document?.data && Object.keys(selectedSession.result.document.data).length > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>EXTRACTED DOCUMENT DATA</div>
                                <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '13px' }}>
                                    {Object.entries(selectedSession.result.document.data).filter(([, v]) => v).map(([k, v]) => (
                                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                                            <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{k.replace(/([A-Z])/g, ' $1')}</span>
                                            <span style={{ fontWeight: 600 }}>{v}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Analysis checks */}
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>CHECKS</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <CheckRow label="OCR Extraction" passed={selectedSession.result?.document?.ocrExtracted} />
                                <CheckRow label="MRZ Validation" passed={selectedSession.result?.document?.mrzValid} />
                                {selectedSession.result?.face && (
                                    <>
                                        <CheckRow label="Face on Document" passed={selectedSession.result.face.faceOnDocument} />
                                        <CheckRow label="Face on Selfie" passed={selectedSession.result.face.faceOnSelfie} />
                                        <CheckRow
                                            label={`Face Match (${selectedSession.result.face.matchScore !== undefined ? ((1 - selectedSession.result.face.matchScore) * 100).toFixed(0) + '% similarity' : 'N/A'})`}
                                            passed={selectedSession.result.face.matchScore !== undefined ? selectedSession.result.face.matchScore < 0.45 : undefined}
                                        />
                                    </>
                                )}
                                {selectedSession.result?.liveness && (
                                    <>
                                        <CheckRow label="Liveness Check" passed={selectedSession.result.liveness.passed} />
                                        <CheckRow label="Blink Detected" passed={selectedSession.result.liveness.blinkDetected} />
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Risk signals */}
                        {selectedSession.result?.signals && selectedSession.result.signals.length > 0 && (
                            <div>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>RISK SIGNALS</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {selectedSession.result.signals.map((sig, i) => (
                                        <div key={i} style={{
                                            padding: '8px 12px', borderRadius: '8px', fontSize: '12px',
                                            background: sig.severity === 'CRITICAL' ? 'rgba(239,68,68,0.08)' : sig.severity === 'HIGH' ? 'rgba(245,158,11,0.08)' : 'rgba(113,113,122,0.08)',
                                            border: `1px solid ${sig.severity === 'CRITICAL' ? 'rgba(239,68,68,0.2)' : sig.severity === 'HIGH' ? 'rgba(245,158,11,0.2)' : 'rgba(113,113,122,0.2)'}`,
                                        }}>
                                            <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '11px', marginBottom: '2px' }}>
                                                <span style={{ color: sig.severity === 'CRITICAL' ? '#ef4444' : sig.severity === 'HIGH' ? '#f59e0b' : '#71717a' }}>{sig.severity}</span> · {sig.signal}
                                            </div>
                                            <div style={{ color: 'var(--text-secondary)' }}>{sig.description}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function CheckRow({ label, passed }: { label: string; passed?: boolean }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '13px' }}>
            <span style={{ fontSize: '14px' }}>{passed === true ? '✅' : passed === false ? '❌' : '⬜'}</span>
            <span>{label}</span>
        </div>
    );
}
