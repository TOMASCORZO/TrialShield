import type { Metadata } from 'next';
import AdminGuard from './AdminGuard';
import LogoutButton from '../dashboard/LogoutButton';

export const metadata: Metadata = {
    title: 'Admin · TrialShield',
    robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <AdminGuard>
            <div className="dashboard-layout">
                <aside className="sidebar">
                    <a href="/" className="sidebar-logo">
                        🛡️ <span className="gradient-text">TrialShield</span>
                    </a>
                    <div style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 500,
                        color: 'var(--accent-deep)',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        fontFamily: 'var(--font-mono)',
                        background: 'var(--accent-soft)',
                        borderRadius: '999px',
                        marginBottom: '20px',
                        border: '1px solid var(--accent-line)',
                        display: 'inline-block',
                    }}>
                        Admin
                    </div>

                    <nav className="sidebar-nav">
                        <a href="/admin/trials" id="nav-admin-trials">
                            <span>🎟️</span> Trial Requests
                        </a>
                        <a href="/dashboard" id="nav-back-to-dash">
                            <span>↩️</span> Back to Dashboard
                        </a>
                    </nav>

                    <div className="sidebar-footer">
                        <LogoutButton />
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '16px' }}>
                            TrialShield v1.0.0
                        </div>
                    </div>
                </aside>

                <main className="main-content">
                    {children}
                </main>
            </div>
        </AdminGuard>
    );
}
