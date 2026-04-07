'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface KycSession {
    id: string;
    external_user_id: string;
    status: string;
    result?: {
        verified?: boolean;
        riskScore?: number;
        signals?: string[];
        selfieReuse?: number;
        documentReuse?: number;
    };
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
    const [createdUrl, setCreatedUrl] = useState('');
    const [filter, setFilter] = useState<string>('all');

    useEffect(() => { fetchSessions(); }, []);

    async function fetchSessions() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch('/api/v1/kyc/session' + (filter !== 'all' ? `?status=${filter}` : ''), {
                headers: {
                    'X-API-Key': process.env.NEXT_PUBLIC_TRIALSHIELD_TEST_KEY || 'master',
                },
            });
            const data = await res.json();
            setSessions(data.sessions || []);
        } catch { }
        finally { setLoading(false); }
    }

    useEffect(() => {
        setLoading(true);
        fetchSessions();
    }, [filter]);

    async function createSession() {
        if (!newUserId.trim()) return;
        setCreating(true);
        setCreatedUrl('');

        try {
            const res = await fetch('/api/v1/kyc/session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': process.env.NEXT_PUBLIC_TRIALSHIELD_TEST_KEY || 'master',
                },
                body: JSON.stringify({
                    userId: newUserId.trim(),
                    redirectUrl: newRedirectUrl.trim() || undefined,
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

    const statusBadge = (status: string, result?: KycSession['result']) => {
        const colors: Record<string, { bg: string; color: string }> = {
            pending: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
            in_progress: { bg: 'rgba(99,102,241,0.1)', color: '#6366f1' },
            completed: result?.verified
                ? { bg: 'rgba(16,185,129,0.1)', color: '#10b981' }
                : { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
            expired: { bg: 'rgba(113,113,122,0.1)', color: '#71717a' },
            failed: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
        };
        const c = colors[status] || colors.pending;
        const label = status === 'completed'
            ? (result?.verified ? 'Verified' : 'Flagged')
            : status.replace('_', ' ');

        return (
            <span style={{
                background: c.bg, color: c.color,
                padding: '4px 10px', borderRadius: '6px',
                fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
            }}>
                {label}
            </span>
        );
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                <div className="loading-spinner" style={{ width: '40px', height: '40px' }}></div>
            </div>
        );
    }

    const completedCount = sessions.filter(s => s.status === 'completed').length;
    const verifiedCount = sessions.filter(s => s.result?.verified).length;
    const flaggedCount = sessions.filter(s => s.status === 'completed' && !s.result?.verified).length;
    const pendingCount = sessions.filter(s => s.status === 'pending').length;

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1>🪪 KYC Verification</h1>
                    <p>Identity verification sessions for your users</p>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                {[
                    { label: 'Total Sessions', value: sessions.length, color: '#6366f1' },
                    { label: 'Verified', value: verifiedCount, color: '#10b981' },
                    { label: 'Flagged', value: flaggedCount, color: '#ef4444' },
                    { label: 'Pending', value: pendingCount, color: '#f59e0b' },
                ].map(stat => (
                    <div key={stat.label} className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{stat.label}</div>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px', color: 'var(--text-muted)' }}>
                            USER ID *
                        </label>
                        <input
                            type="text"
                            placeholder="user_abc123"
                            value={newUserId}
                            onChange={e => setNewUserId(e.target.value)}
                            style={{ width: '100%', fontSize: '13px' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px', color: 'var(--text-muted)' }}>
                            REDIRECT URL (optional)
                        </label>
                        <input
                            type="text"
                            placeholder="https://your-app.com/callback"
                            value={newRedirectUrl}
                            onChange={e => setNewRedirectUrl(e.target.value)}
                            style={{ width: '100%', fontSize: '13px' }}
                        />
                    </div>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={createSession}
                        disabled={creating || !newUserId.trim()}
                        style={{ padding: '10px 20px', whiteSpace: 'nowrap' }}
                    >
                        {creating ? 'Creating...' : '+ Create Session'}
                    </button>
                </div>

                {createdUrl && (
                    <div style={{
                        marginTop: '16px', padding: '12px 16px',
                        background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                        borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px',
                    }}>
                        <span>✅</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Verification URL (send to your user):</div>
                            <code style={{ fontSize: '13px', color: 'var(--color-allow)', wordBreak: 'break-all' }}>{createdUrl}</code>
                        </div>
                        <button
                            className="btn btn-sm"
                            style={{ fontSize: '12px', padding: '6px 12px' }}
                            onClick={() => navigator.clipboard.writeText(createdUrl)}
                        >
                            Copy
                        </button>
                    </div>
                )}

                {/* API Example */}
                <div style={{
                    marginTop: '16px', padding: '12px 16px',
                    background: 'var(--bg-primary)', borderRadius: '8px',
                    fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-muted)',
                    lineHeight: '1.6',
                }}>
                    <span style={{ color: 'var(--text-muted)' }}>// API Usage:</span><br />
                    POST /api/v1/kyc/session<br />
                    {`{ "userId": "user_123", "redirectUrl": "https://..." }`}<br />
                    <span style={{ color: 'var(--color-allow)' }}>{`→ { "sessionId": "...", "verifyUrl": "https://trialshield.cc/verify/..." }`}</span>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {['all', 'pending', 'completed', 'expired'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className="btn btn-sm"
                        style={{
                            background: filter === f ? 'rgba(99,102,241,0.15)' : 'var(--bg-tertiary)',
                            color: filter === f ? '#6366f1' : 'var(--text-muted)',
                            border: filter === f ? '1px solid rgba(99,102,241,0.3)' : '1px solid var(--border-subtle)',
                            fontSize: '12px', padding: '6px 14px', textTransform: 'capitalize',
                        }}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* Sessions Table */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>User ID</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Risk Score</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Signals</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sessions.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    No verification sessions yet. Create one above to get started.
                                </td>
                            </tr>
                        ) : sessions.map(s => (
                            <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <td style={{ padding: '12px 16px' }}>
                                    <code style={{ fontSize: '12px' }}>{s.external_user_id}</code>
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                    {statusBadge(s.status, s.result)}
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                    {s.result?.riskScore !== undefined ? (
                                        <span style={{
                                            fontWeight: 700,
                                            color: s.result.riskScore > 50 ? '#ef4444' : s.result.riskScore > 20 ? '#f59e0b' : '#10b981',
                                        }}>
                                            {s.result.riskScore}
                                        </span>
                                    ) : (
                                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                                    )}
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                    {s.result?.signals?.length ? (
                                        <span style={{ fontSize: '12px', color: '#ef4444' }}>
                                            {s.result.signals.length} signal{s.result.signals.length > 1 ? 's' : ''}
                                        </span>
                                    ) : s.status === 'completed' ? (
                                        <span style={{ fontSize: '12px', color: '#10b981' }}>Clean</span>
                                    ) : (
                                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                                    )}
                                </td>
                                <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                                    {new Date(s.created_at).toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
