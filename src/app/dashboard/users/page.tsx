'use client';

import { useState, useEffect } from 'react';

interface UserData {
    id: string;
    email_hash: string | null;
    first_seen: string;
    last_seen: string;
    total_evaluations: number;
    highest_risk_score: number;
    last_decision: string;
    is_quarantined: boolean;
    infractionPercentage: number;
    relationshipFound: boolean;
    matchedUser: string | null;
    rejectionReasons: string[];
    latestEventDate: string;
}

export default function UsersPage() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUsers();
    }, []);

    async function fetchUsers() {
        try {
            const res = await fetch('/api/v1/dashboard/users');
            const data = await res.json();
            if (data.users) {
                setUsers(data.users);
            }
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
        }
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
            <div className="page-header" style={{ marginBottom: '32px' }}>
                <div>
                    <h1>Users Overview</h1>
                    <p>Track persistent identities, relationships, and abuse infractions in real-time.</p>
                </div>
                <button onClick={fetchUsers} className="btn btn-secondary">
                    ↻ Refresh List
                </button>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
                {users.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">👥</div>
                        <h3>No users tracked yet</h3>
                        <p>Users will appear here once they are evaluated by the TrialShield API.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>User ID (Anonymized)</th>
                                    <th>Status</th>
                                    <th>Infraction %</th>
                                    <th>Duplicate Relationship</th>
                                    <th>Rejection Reason / Signals</th>
                                    <th>Last Seen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <tr key={user.id}>
                                        <td style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                            {user.id.split('-').shift()}-...
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                {user.email_hash ? `Email Hash: ${user.email_hash.substring(0, 8)}...` : 'No Email'}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge badge-${(user.last_decision || 'ALLOW').toLowerCase()}`}>
                                                {user.last_decision || 'ALLOW'}
                                            </span>
                                            {user.is_quarantined && (
                                                <span className="badge" style={{ backgroundColor: 'transparent', border: '1px solid var(--color-deny)', color: 'var(--color-deny)', marginLeft: '8px' }}>
                                                    QUARANTINED
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '60px', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                                                    <div 
                                                        style={{ 
                                                            height: '100%', 
                                                            width: `${Math.min(100, user.infractionPercentage)}%`, 
                                                            background: user.infractionPercentage >= 80 ? 'var(--color-deny)' : user.infractionPercentage >= 40 ? 'var(--color-challenge)' : 'var(--color-allow)'
                                                        }} 
                                                    />
                                                </div>
                                                <span className={`score-indicator ${user.infractionPercentage <= 30 ? 'score-low' : user.infractionPercentage <= 70 ? 'score-medium' : 'score-high'}`}>
                                                    {user.infractionPercentage}%
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            {user.relationshipFound ? (
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: 'var(--color-challenge)' }}>
                                                    <span style={{ fontSize: '16px' }}>🔗</span>
                                                    <div>
                                                        <div style={{ fontWeight: '600', fontSize: '13px' }}>Duplicate Target Found</div>
                                                        <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>Already took free trial via linked account.</div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No links detected</span>
                                            )}
                                        </td>
                                        <td style={{ maxWidth: '300px' }}>
                                            {(user.last_decision === 'DENY' || user.last_decision === 'REVOKE') ? (
                                                user.rejectionReasons.length > 0 ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        {user.rejectionReasons.map((reason, idx) => (
                                                            <div key={idx} className="signal-tag critical" style={{ whiteSpace: 'normal', display: 'inline-block', lineHeight: '1.4' }}>
                                                                {reason}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="signal-tag high">High Risk Threshold Exceeded</span>
                                                )
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>-</span>
                                            )}
                                        </td>
                                        <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                            {new Date(user.latestEventDate).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
