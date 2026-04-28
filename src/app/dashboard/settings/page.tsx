'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function SettingsPage() {
    const [keys, setKeys] = useState<any[]>([]);
    const [newKeyName, setNewKeyName] = useState('');
    const [createdKey, setCreatedKey] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchKeys(); }, []);

    async function authHeaders(): Promise<HeadersInit | null> {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return null;
        return { 'Authorization': `Bearer ${session.access_token}` };
    }

    async function fetchKeys() {
        try {
            const headers = await authHeaders();
            if (!headers) return;
            const res = await fetch('/api/v1/keys', { headers });
            const data = await res.json();
            setKeys(data.keys || []);
        } catch { }
        finally { setLoading(false); }
    }

    async function createKey() {
        if (!newKeyName) return;
        try {
            const headers = await authHeaders();
            if (!headers) return;
            const res = await fetch('/api/v1/keys', {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newKeyName }),
            });
            const data = await res.json();
            if (data.key) {
                setCreatedKey(data.key);
                setNewKeyName('');
                fetchKeys();
            }
        } catch { }
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1>⚙️ Settings</h1>
                    <p>API keys, thresholds, and configuration</p>
                </div>
            </div>

            {/* ─── API Keys ────────────────────────────────────── */}
            <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '20px' }}>🔑 API Keys</h3>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                    <input
                        type="text"
                        placeholder="New key name (e.g., Production, Staging)"
                        value={newKeyName}
                        onChange={e => setNewKeyName(e.target.value)}
                        style={{ maxWidth: '400px' }}
                    />
                    <button className="btn btn-primary btn-sm" onClick={createKey}>
                        ➕ Create Key
                    </button>
                </div>

                {createdKey && (
                    <div style={{
                        padding: '16px', marginBottom: '20px',
                        background: 'var(--color-allow-bg)',
                        border: '1px solid rgba(16,185,129,0.2)',
                        borderRadius: '8px',
                    }}>
                        <div style={{ fontSize: '13px', color: 'var(--color-allow)', fontWeight: 600, marginBottom: '4px' }}>
                            ⚠️ API Key Created — copy it now, it won&apos;t be shown again!
                        </div>
                        <code style={{ fontSize: '14px', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                            {createdKey}
                        </code>
                    </div>
                )}

                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Status</th>
                            <th>Rate Limit</th>
                            <th>Total Requests</th>
                            <th>Last Used</th>
                            <th>Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        {keys.map(key => (
                            <tr key={key.id}>
                                <td style={{ fontWeight: 600 }}>{key.name}</td>
                                <td>
                                    <span className={`badge ${key.is_active ? 'badge-allow' : 'badge-deny'}`}>
                                        {key.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td>{key.rate_limit}/min</td>
                                <td>{key.total_requests?.toLocaleString() || 0}</td>
                                <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                    {key.last_used ? new Date(key.last_used).toLocaleDateString() : 'Never'}
                                </td>
                                <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                    {new Date(key.created_at).toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                        {keys.length === 0 && !loading && (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                                    No API keys created yet. Create one above to get started.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* ─── Thresholds ──────────────────────────────────── */}
            <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '20px' }}>🎚️ Decision Thresholds</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                    <div style={{ padding: '20px', background: 'var(--color-allow-bg)', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.15)' }}>
                        <div style={{ fontSize: '13px', color: 'var(--color-allow)', fontWeight: 600, marginBottom: '8px' }}>✅ ALLOW</div>
                        <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-allow)' }}>0 — 30</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Low risk, no friction</div>
                    </div>
                    <div style={{ padding: '20px', background: 'var(--color-challenge-bg)', borderRadius: '12px', border: '1px solid rgba(245,158,11,0.15)' }}>
                        <div style={{ fontSize: '13px', color: 'var(--color-challenge)', fontWeight: 600, marginBottom: '8px' }}>⚠️ CHALLENGE</div>
                        <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-challenge)' }}>31 — 70</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Step-up verification</div>
                    </div>
                    <div style={{ padding: '20px', background: 'var(--color-deny-bg)', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.15)' }}>
                        <div style={{ fontSize: '13px', color: 'var(--color-deny)', fontWeight: 600, marginBottom: '8px' }}>🚫 DENY</div>
                        <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-deny)' }}>71 — 100</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Block + flag for review</div>
                    </div>
                </div>
            </div>

            {/* ─── Module Weights ──────────────────────────────── */}
            <div className="glass-card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '20px' }}>⚖️ Module Weights</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    {[
                        { name: 'Email', weight: '20%', icon: '📧' },
                        { name: 'Phone', weight: '10%', icon: '📱' },
                        { name: 'IP', weight: '25%', icon: '🌐' },
                        { name: 'Device', weight: '20%', icon: '🖥️' },
                        { name: 'Behavior', weight: '10%', icon: '🧠' },
                        { name: 'Graph', weight: '15%', icon: '🔗' },
                    ].map(m => (
                        <div key={m.name} style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '16px', background: 'var(--bg-secondary)',
                            borderRadius: '8px', border: '1px solid var(--border-subtle)',
                        }}>
                            <span style={{ fontSize: '24px' }}>{m.icon}</span>
                            <div>
                                <div style={{ fontSize: '14px', fontWeight: 600 }}>{m.name}</div>
                                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-accent)' }}>{m.weight}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
