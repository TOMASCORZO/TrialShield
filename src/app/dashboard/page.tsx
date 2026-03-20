'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Stats {
    totalEvaluations: number;
    evaluationsToday: number;
    allowRate: number;
    denyRate: number;
    challengeRate: number;
    avgRiskScore: number;
    recentEvaluations: any[];
    riskDistribution: { range: string; count: number }[];
    allowCount: number;
    denyCount: number;
    challengeCount: number;
}

export default function DashboardPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    async function fetchStats() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            
            const res = await fetch('/api/v1/stats', {
                headers: {
                    'Authorization': `Bearer ${session?.access_token || ''}`
                }
            });
            
            if (!res.ok) {
                if (res.status === 401) {
                    window.location.href = '/login';
                    return;
                }
                throw new Error(`Failed to fetch stats: ${res.statusText}`);
            }
            const data = await res.json();
            setStats(data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
            setStats({
                totalEvaluations: 0, evaluationsToday: 0,
                allowRate: 0, denyRate: 0, challengeRate: 0,
                avgRiskScore: 0, recentEvaluations: [],
                riskDistribution: [], allowCount: 0, denyCount: 0, challengeCount: 0,
            });
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

    const maxDistribution = Math.max(...(stats?.riskDistribution?.map(d => d.count) || [1]));

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1>Dashboard</h1>
                    <p>Real-time trial abuse detection overview</p>
                </div>
                <a href="/dashboard/test" className="btn btn-primary">
                    🧪 Test API
                </a>
            </div>

            {/* ─── Stats Grid ────────────────────────────────── */}
            <div className="stats-grid">
                <div className="glass-card stat-card">
                    <div className="stat-label">Total Evaluations</div>
                    <div className="stat-value">{stats?.totalEvaluations?.toLocaleString() || 0}</div>
                </div>
                <div className="glass-card stat-card">
                    <div className="stat-label">Today</div>
                    <div className="stat-value">{stats?.evaluationsToday?.toLocaleString() || 0}</div>
                </div>
                <div className="glass-card stat-card">
                    <div className="stat-label">Allow Rate</div>
                    <div className="stat-value" style={{ color: 'var(--color-allow)' }}>{stats?.allowRate || 0}%</div>
                </div>
                <div className="glass-card stat-card">
                    <div className="stat-label">Deny Rate</div>
                    <div className="stat-value" style={{ color: 'var(--color-deny)' }}>{stats?.denyRate || 0}%</div>
                </div>
                <div className="glass-card stat-card">
                    <div className="stat-label">Challenge Rate</div>
                    <div className="stat-value" style={{ color: 'var(--color-challenge)' }}>{stats?.challengeRate || 0}%</div>
                </div>
            </div>

            {/* ─── Charts Row ────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                {/* Decision Distribution */}
                <div className="glass-card chart-container">
                    <h3 style={{ fontSize: '16px', marginBottom: '24px' }}>Decision Distribution</h3>
                    <div className="donut-chart">
                        <svg width="160" height="160" viewBox="0 0 36 36" className="donut-visual">
                            <circle cx="18" cy="18" r="15.9" fill="transparent" stroke="var(--bg-tertiary)" strokeWidth="3"></circle>
                            <circle
                                cx="18" cy="18" r="15.9" fill="transparent"
                                stroke="var(--color-allow)" strokeWidth="3"
                                strokeDasharray={`${stats?.allowRate || 33} ${100 - (stats?.allowRate || 33)}`}
                                strokeDashoffset="25"
                            ></circle>
                            <circle
                                cx="18" cy="18" r="15.9" fill="transparent"
                                stroke="var(--color-challenge)" strokeWidth="3"
                                strokeDasharray={`${stats?.challengeRate || 33} ${100 - (stats?.challengeRate || 33)}`}
                                strokeDashoffset={`${25 - (stats?.allowRate || 33)}`}
                            ></circle>
                            <circle
                                cx="18" cy="18" r="15.9" fill="transparent"
                                stroke="var(--color-deny)" strokeWidth="3"
                                strokeDasharray={`${stats?.denyRate || 34} ${100 - (stats?.denyRate || 34)}`}
                                strokeDashoffset={`${25 - (stats?.allowRate || 33) - (stats?.challengeRate || 33)}`}
                            ></circle>
                        </svg>
                        <div className="donut-legend">
                            <div className="legend-item">
                                <div className="legend-dot allow"></div>
                                <span>Allow ({stats?.allowCount || 0})</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-dot challenge"></div>
                                <span>Challenge ({stats?.challengeCount || 0})</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-dot deny"></div>
                                <span>Deny ({stats?.denyCount || 0})</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Risk Distribution */}
                <div className="glass-card chart-container">
                    <h3 style={{ fontSize: '16px', marginBottom: '24px' }}>Risk Score Distribution</h3>
                    <div className="bar-chart" style={{ paddingBottom: '32px' }}>
                        {(stats?.riskDistribution || [
                            { range: '0-20', count: 0 },
                            { range: '20-40', count: 0 },
                            { range: '40-60', count: 0 },
                            { range: '60-80', count: 0 },
                            { range: '80-100', count: 0 },
                        ]).map((bucket, i) => {
                            const colors = ['var(--color-allow)', '#22d3ee', 'var(--color-challenge)', '#f97316', 'var(--color-deny)'];
                            const height = maxDistribution > 0 ? (bucket.count / maxDistribution) * 100 : 5;
                            return (
                                <div
                                    key={bucket.range}
                                    className="bar"
                                    style={{
                                        height: `${Math.max(5, height)}%`,
                                        background: colors[i],
                                        opacity: 0.85,
                                    }}
                                >
                                    <span className="bar-value">{bucket.count}</span>
                                    <span className="bar-label">{bucket.range}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ─── Recent Evaluations ────────────────────────── */}
            <div className="glass-card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '20px' }}>Recent Evaluations</h3>
                {(stats?.recentEvaluations?.length || 0) === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🛡️</div>
                        <h3>No evaluations yet</h3>
                        <p>Send your first request to /api/v1/verify to see results here.</p>
                        <a href="/dashboard/test" className="btn btn-primary btn-sm" style={{ marginTop: '16px' }}>
                            🧪 Test API Now
                        </a>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Decision</th>
                                <th>Score</th>
                                <th>Email</th>
                                <th>IP</th>
                                <th>Device</th>
                                <th>Behavior</th>
                                <th>Signals</th>
                                <th>Latency</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats?.recentEvaluations?.map((ev: any) => (
                                <tr key={ev.id}>
                                    <td style={{ whiteSpace: 'nowrap', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                        {new Date(ev.created_at).toLocaleTimeString()}
                                    </td>
                                    <td>
                                        <span className={`badge badge-${ev.decision.toLowerCase()}`}>
                                            {ev.decision}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`score-indicator ${ev.risk_score <= 30 ? 'score-low' : ev.risk_score <= 70 ? 'score-medium' : 'score-high'}`}>
                                            {ev.risk_score}
                                        </span>
                                    </td>
                                    <td>{ev.email_score}</td>
                                    <td>{ev.ip_score}</td>
                                    <td>{ev.device_score}</td>
                                    <td>{ev.behavior_score}</td>
                                    <td>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', maxWidth: '300px' }}>
                                            {(ev.signals || []).slice(0, 3).map((s: any, i: number) => (
                                                <span key={i} className={`signal-tag ${s.severity?.toLowerCase()}`}>
                                                    {s.signal}
                                                </span>
                                            ))}
                                            {(ev.signals?.length || 0) > 3 && (
                                                <span className="signal-tag low">+{ev.signals.length - 3}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                        {ev.processing_time_ms}ms
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
