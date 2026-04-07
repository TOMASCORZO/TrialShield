import type { Metadata } from 'next';
import AuthGuard from './AuthGuard';
import LogoutButton from './LogoutButton';

export const metadata: Metadata = {
    title: 'Dashboard — TrialShield',
};

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthGuard>
            <div className="dashboard-layout">
                {/* ─── Sidebar ───────────────────────────────────── */}
            <aside className="sidebar">
                <a href="/" className="sidebar-logo">
                    🛡️ <span className="gradient-text">TrialShield</span>
                </a>

                <nav className="sidebar-nav">
                    <a href="/dashboard" id="nav-overview">
                        <span>📊</span> Overview
                    </a>
                    <a href="/dashboard/users" id="nav-users">
                        <span>👥</span> Users
                    </a>
                    <a href="/dashboard/events" id="nav-events">
                        <span>📋</span> Events
                    </a>
                    <a href="/dashboard/test" id="nav-test">
                        <span>🧪</span> Test API
                    </a>
                    <a href="/dashboard/oauth" id="nav-oauth">
                        <span>🔐</span> Auth Providers
                    </a>
                    <a href="/dashboard/kyc" id="nav-kyc">
                        <span>🪪</span> KYC
                    </a>
                    <a href="/dashboard/stripe" id="nav-stripe">
                        <span>💳</span> Stripe
                    </a>
                    <a href="/dashboard/billing" id="nav-billing">
                        <span>💰</span> Billing
                    </a>
                    <a href="/dashboard/settings" id="nav-settings">
                        <span>⚙️</span> Settings
                    </a>
                </nav>

                <div className="sidebar-footer">
                    <LogoutButton />
                    
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '16px' }}>
                        TrialShield v1.0.0
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        12 modules active
                    </div>
                </div>
            </aside>

            {/* ─── Main Content ──────────────────────────────── */}
            <main className="main-content">
                {children}
            </main>
        </div>
        </AuthGuard>
    );
}
