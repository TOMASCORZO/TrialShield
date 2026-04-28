'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Filter = 'pending' | 'all';

interface TrialRequest {
    id: string;
    name: string;
    owner_id: string | null;
    owner_email: string | null;
    trial_requested_at: string | null;
    trial_request_note: string | null;
    plan: string;
    subscription_status: string;
    created_at: string;
}

const DURATION_OPTIONS = [7, 14, 30, 60];

export default function AdminTrialsPage() {
    const [filter, setFilter] = useState<Filter>('pending');
    const [requests, setRequests] = useState<TrialRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [approveTarget, setApproveTarget] = useState<TrialRequest | null>(null);
    const [duration, setDuration] = useState<number>(14);
    const [toast, setToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

    useEffect(() => { fetchRequests(); }, []);

    function showToast(kind: 'success' | 'error', message: string) {
        setToast({ kind, message });
        setTimeout(() => setToast(null), 4000);
    }

    async function authFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('not authenticated');
        const headers = new Headers(init.headers);
        headers.set('Authorization', `Bearer ${session.access_token}`);
        return fetch(input, { ...init, headers });
    }

    async function fetchRequests() {
        setLoading(true);
        setError(null);
        try {
            const res = await authFetch('/api/v1/admin/list-trial-requests');
            if (!res.ok) throw new Error('Failed to load requests');
            const data = await res.json();
            setRequests(data.requests || []);
        } catch (e: any) {
            setError(e.message || 'Failed to load requests');
        } finally {
            setLoading(false);
        }
    }

    async function approve(req: TrialRequest, days: number) {
        setPendingId(req.id);
        try {
            const res = await authFetch('/api/v1/admin/approve-trial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKeyId: req.id, durationDays: days }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Approval failed');
            showToast('success', `Approved trial for ${req.owner_email || 'user'} (${days} days)`);
            setRequests(prev => prev.filter(r => r.id !== req.id));
        } catch (e: any) {
            showToast('error', e.message || 'Approval failed');
        } finally {
            setPendingId(null);
            setApproveTarget(null);
        }
    }

    async function reject(req: TrialRequest) {
        if (!confirm(`Reject trial request from ${req.owner_email || 'this user'}? They will be told their request was denied.`)) return;
        setPendingId(req.id);
        try {
            const res = await authFetch('/api/v1/admin/reject-trial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKeyId: req.id }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Rejection failed');
            showToast('success', `Rejected trial for ${req.owner_email || 'user'}`);
            setRequests(prev => prev.filter(r => r.id !== req.id));
        } catch (e: any) {
            showToast('error', e.message || 'Rejection failed');
        } finally {
            setPendingId(null);
        }
    }

    const visibleRequests = useMemo(() => {
        if (filter === 'pending') return requests;
        return requests; // 'all' currently same — placeholder for future filters
    }, [requests, filter]);

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1>Trial Requests</h1>
                    <p>Review and approve free trial access requests.</p>
                </div>
                <button className="btn btn-secondary" onClick={fetchRequests} disabled={loading}>
                    ↻ Refresh
                </button>
            </div>

            {/* Filter pills */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                {(['pending', 'all'] as Filter[]).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className="btn btn-sm"
                        style={{
                            background: filter === f ? 'var(--text-accent)' : 'var(--bg-secondary)',
                            color: filter === f ? 'white' : 'var(--text-secondary)',
                            border: '1px solid var(--border-subtle)',
                            textTransform: 'capitalize',
                        }}
                    >
                        {f === 'pending' ? `Pending (${requests.length})` : f}
                    </button>
                ))}
            </div>

            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', top: '24px', right: '24px', zIndex: 100,
                    padding: '14px 20px',
                    background: toast.kind === 'success' ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.95)',
                    color: 'white', borderRadius: '10px',
                    fontWeight: 600, fontSize: '14px',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
                }}>
                    {toast.message}
                </div>
            )}

            {/* Error banner */}
            {error && (
                <div style={{
                    padding: '14px 20px', marginBottom: '20px',
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: '12px', color: 'var(--color-deny)', fontSize: '14px',
                }}>
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Loading requests…
                    </div>
                ) : visibleRequests.length === 0 ? (
                    <div className="empty-state" style={{ padding: '60px 20px' }}>
                        <div className="empty-state-icon">✨</div>
                        <h3>No pending trial requests</h3>
                        <p>You&apos;re all caught up. New requests will appear here automatically.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Email</th>
                                    <th>Requested</th>
                                    <th style={{ minWidth: '220px' }}>Note</th>
                                    <th>Key Name</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleRequests.map(req => {
                                    const requestedAgo = req.trial_requested_at
                                        ? timeAgo(req.trial_requested_at)
                                        : '—';
                                    const isBusy = pendingId === req.id;
                                    return (
                                        <tr key={req.id} style={{ opacity: isBusy ? 0.5 : 1 }}>
                                            <td style={{ fontWeight: 600 }}>
                                                {req.owner_email || <span style={{ color: 'var(--text-muted)' }}>unknown</span>}
                                            </td>
                                            <td style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                                {requestedAgo}
                                            </td>
                                            <td style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '320px' }}>
                                                {req.trial_request_note || <em style={{ color: 'var(--text-muted)' }}>No note provided</em>}
                                            </td>
                                            <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                                {req.name}
                                            </td>
                                            <td>
                                                <span className="badge badge-deny">{req.subscription_status}</span>
                                            </td>
                                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                <button
                                                    className="btn btn-sm"
                                                    style={{
                                                        background: 'var(--color-allow)', color: 'white',
                                                        border: 'none', marginRight: '6px',
                                                    }}
                                                    disabled={isBusy}
                                                    onClick={() => { setApproveTarget(req); setDuration(14); }}
                                                >
                                                    {isBusy ? '…' : 'Approve'}
                                                </button>
                                                <button
                                                    className="btn btn-sm"
                                                    style={{
                                                        background: 'transparent',
                                                        border: '1px solid var(--color-deny)',
                                                        color: 'var(--color-deny)',
                                                    }}
                                                    disabled={isBusy}
                                                    onClick={() => reject(req)}
                                                >
                                                    Reject
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Approve modal */}
            {approveTarget && (
                <div
                    onClick={() => setApproveTarget(null)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 90,
                        background: 'rgba(0,0,0,0.6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '20px',
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className="glass-card"
                        style={{ padding: '28px', maxWidth: '460px', width: '100%' }}
                    >
                        <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>Approve free trial</h3>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                            Granting <strong>{approveTarget.owner_email || 'this user'}</strong> access starting now.
                        </p>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
                                TRIAL DURATION
                            </label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {DURATION_OPTIONS.map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setDuration(d)}
                                        className="btn btn-sm"
                                        style={{
                                            background: duration === d ? 'var(--text-accent)' : 'var(--bg-secondary)',
                                            color: duration === d ? 'white' : 'var(--text-secondary)',
                                            border: '1px solid var(--border-subtle)',
                                            minWidth: '64px',
                                        }}
                                    >
                                        {d} days
                                    </button>
                                ))}
                            </div>
                        </div>

                        {approveTarget.trial_request_note && (
                            <div style={{
                                padding: '12px 14px', marginBottom: '20px',
                                background: 'var(--bg-secondary)', borderRadius: '8px',
                                fontSize: '13px', color: 'var(--text-secondary)',
                                borderLeft: '3px solid var(--text-accent)',
                            }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.5px' }}>
                                    USER NOTE
                                </div>
                                {approveTarget.trial_request_note}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setApproveTarget(null)}
                                className="btn btn-secondary btn-sm"
                                disabled={pendingId === approveTarget.id}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => approve(approveTarget, duration)}
                                className="btn btn-primary btn-sm"
                                disabled={pendingId === approveTarget.id}
                                style={{ background: 'var(--color-allow)', borderColor: 'var(--color-allow)' }}
                            >
                                {pendingId === approveTarget.id ? 'Approving…' : `Approve for ${duration} days`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function timeAgo(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
}
