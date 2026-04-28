// Marketing footer with sitelinks, legal, and a status row.
// Mirrors the design bundle's Footer.

import Logo from './Logo';

const COLS = [
    { title: 'Platform', items: [
        { label: 'Device ID', href: '/#platform' },
        { label: 'Bot detection', href: '/#platform' },
        { label: 'VPN/Proxy', href: '/#platform' },
        { label: 'Account linking', href: '/#platform' },
        { label: 'Risk scoring', href: '/#platform' },
    ]},
    { title: 'Developers', items: [
        { label: 'Documentation', href: '/docs' },
        { label: 'API reference', href: '/docs' },
        { label: 'SDKs', href: '/docs' },
        { label: 'Status', href: '#' },
    ]},
    { title: 'Company', items: [
        { label: 'About', href: '#' },
        { label: 'Customers', href: '#' },
        { label: 'Contact', href: 'mailto:tomascorzo1203@gmail.com' },
    ]},
    { title: 'Legal', items: [
        { label: 'Privacy', href: '/privacy' },
        { label: 'Terms', href: '/terms' },
        { label: 'DPA', href: '/privacy' },
        { label: 'Security', href: '/privacy' },
    ]},
];

export default function Footer() {
    return (
        <footer style={{
            borderTop: '1px solid var(--line)',
            padding: '56px 32px 32px',
            background: 'var(--bg)',
        }}>
            <div style={{
                maxWidth: 1280, margin: '0 auto',
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                gap: 48, marginBottom: 48,
            }}>
                <div>
                    <Logo />
                    <p className="t-body-sm" style={{ marginTop: 16, maxWidth: 280 }}>
                        Real-time abuse detection for free trials. 100+ risk signals, sub-100ms latency.
                    </p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                        {['SOC 2', 'GDPR', 'ISO 27001'].map(b => (
                            <span key={b} className="tag">{b}</span>
                        ))}
                    </div>
                </div>
                {COLS.map(col => (
                    <div key={col.title}>
                        <div className="t-eyebrow" style={{ marginBottom: 16 }}>{col.title}</div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {col.items.map(i => (
                                <li key={i.label}>
                                    <a href={i.href} style={{ fontSize: 13, color: 'var(--ink-2)', textDecoration: 'none' }}>
                                        {i.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
            <div style={{
                maxWidth: 1280, margin: '0 auto',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexWrap: 'wrap', gap: 12,
                paddingTop: 24, borderTop: '1px solid var(--line)',
                fontSize: 12, color: 'var(--ink-4)',
                fontFamily: 'var(--font-mono)',
            }}>
                <span>© {new Date().getFullYear()} TrialShield</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="dot dot-green" />
                    All systems operational
                </span>
            </div>
        </footer>
    );
}
