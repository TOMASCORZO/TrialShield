import Link from 'next/link';

export default function NotFound() {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            background: 'var(--bg-primary)',
        }}>
            <div className="glass-card animate-fade-in" style={{ padding: '48px', maxWidth: '480px', textAlign: 'center' }}>
                <div style={{ fontSize: '64px', marginBottom: '16px' }}>🛡️</div>
                <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>404 — Page not found</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '32px' }}>
                    The page you&apos;re looking for doesn&apos;t exist or has been moved.
                </p>
                <Link href="/" className="btn btn-primary">
                    ← Back to home
                </Link>
            </div>
        </div>
    );
}
