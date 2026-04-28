'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { logError } from '@/lib/logger';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        logError('app.error_boundary', error, { digest: error.digest });
    }, [error]);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            background: 'var(--bg-primary)',
        }}>
            <div className="glass-card animate-fade-in" style={{ padding: '48px', maxWidth: '520px', textAlign: 'center' }}>
                <div style={{ fontSize: '64px', marginBottom: '16px' }}>⚠️</div>
                <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Something went wrong</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '24px' }}>
                    We hit an unexpected error. Our team has been notified.
                </p>
                {error.digest && (
                    <code style={{
                        display: 'block',
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        marginBottom: '24px',
                        padding: '8px 12px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '6px',
                        wordBreak: 'break-all',
                    }}>
                        ref: {error.digest}
                    </code>
                )}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button onClick={reset} className="btn btn-primary">
                        Try again
                    </button>
                    <Link href="/" className="btn btn-secondary">
                        Go home
                    </Link>
                </div>
            </div>
        </div>
    );
}
