'use client';

import { useState, useEffect } from 'react';

export default function EventsPage() {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchEvents();
    }, []);

    async function fetchEvents() {
        try {
            const res = await fetch('/api/v1/stats');
            const data = await res.json();
            setEvents(data.recentEvaluations || []);
        } catch { }
        finally { setLoading(false); }
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
                    <h1>📋 Events</h1>
                    <p>All risk evaluation events</p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={fetchEvents}>
                    🔄 Refresh
                </button>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
                {events.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📋</div>
                        <h3>No events yet</h3>
                        <p>Events will appear here after your first API call to /api/v1/verify</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Decision</th>
                                <th>Risk Score</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>IP</th>
                                <th>Device</th>
                                <th>Behavior</th>
                                <th>Graph</th>
                                <th>Signals</th>
                                <th>Latency</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map((ev: any) => (
                                <tr key={ev.id}>
                                    <td style={{ whiteSpace: 'nowrap', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                        {new Date(ev.created_at).toLocaleString()}
                                    </td>
                                    <td>
                                        <span className={`badge badge-${ev.decision?.toLowerCase()}`}>
                                            {ev.decision}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`score-indicator ${ev.risk_score <= 30 ? 'score-low' : ev.risk_score <= 70 ? 'score-medium' : 'score-high'}`}>
                                            {ev.risk_score}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '13px' }}>{ev.email_score}</td>
                                    <td style={{ fontSize: '13px' }}>{ev.phone_score}</td>
                                    <td style={{ fontSize: '13px' }}>{ev.ip_score}</td>
                                    <td style={{ fontSize: '13px' }}>{ev.device_score}</td>
                                    <td style={{ fontSize: '13px' }}>{ev.behavior_score}</td>
                                    <td style={{ fontSize: '13px' }}>{ev.graph_score}</td>
                                    <td>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', maxWidth: '250px' }}>
                                            {(ev.signals || []).slice(0, 2).map((s: any, i: number) => (
                                                <span key={i} className={`signal-tag ${s.severity?.toLowerCase()}`}>
                                                    {s.signal}
                                                </span>
                                            ))}
                                            {(ev.signals?.length || 0) > 2 && (
                                                <span className="signal-tag low">+{ev.signals.length - 2}</span>
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
