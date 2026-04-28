// Sticky top nav for marketing pages. Mirrors the design bundle TopNav.

import Logo from './Logo';
import { ArrowIcon } from './Icon';

export type NavCurrent = 'landing' | 'features' | 'pricing' | 'docs' | 'terms' | 'privacy';

interface TopNavProps {
    current?: NavCurrent;
}

const items: { id: NavCurrent; label: string; href: string }[] = [
    { id: 'features', label: 'Platform', href: '/#platform' },
    { id: 'pricing', label: 'Pricing', href: '/pricing' },
    { id: 'docs', label: 'Docs', href: '/docs' },
    { id: 'terms', label: 'Terms', href: '/terms' },
    { id: 'privacy', label: 'Privacy', href: '/privacy' },
];

export default function TopNav({ current }: TopNavProps) {
    return (
        <header style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 32px',
            borderBottom: '1px solid var(--line)',
            background: 'rgba(251, 251, 252, 0.85)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            position: 'sticky', top: 0, zIndex: 10,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                <a href="/" style={{ textDecoration: 'none' }}>
                    <Logo />
                </a>
                <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {items.map(it => (
                        <a key={it.id} href={it.href} style={{
                            padding: '6px 10px',
                            borderRadius: 6,
                            fontSize: 14,
                            color: current === it.id ? 'var(--ink)' : 'var(--ink-3)',
                            fontWeight: 500,
                            letterSpacing: '-0.005em',
                            textDecoration: 'none',
                        }}>
                            {it.label}
                        </a>
                    ))}
                </nav>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <a href="/login" className="btn btn-ghost btn-sm">Sign in</a>
                <a href="/register" className="btn btn-accent btn-sm">
                    Start free <ArrowIcon size={12} />
                </a>
            </div>
        </header>
    );
}
