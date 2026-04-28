// Shared layout for /terms and /privacy. Renders heading + numbered sections
// using the marketing design tokens.

import TopNav from './TopNav';
import Footer from './Footer';

export interface LegalSection {
    title: string;
    body: React.ReactNode;
}

interface LegalLayoutProps {
    eyebrow: string;
    title: string;
    lastUpdated: string;
    intro?: React.ReactNode;
    sections: LegalSection[];
}

export default function LegalLayout({ eyebrow, title, lastUpdated, intro, sections }: LegalLayoutProps) {
    return (
        <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
            <TopNav />

            <section style={{ padding: '64px 32px 24px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ maxWidth: 760, margin: '0 auto' }}>
                    <div className="t-eyebrow" style={{ color: 'var(--accent)', marginBottom: 16 }}>// {eyebrow}</div>
                    <h1 className="t-h1" style={{ margin: '0 0 12px' }}>{title}</h1>
                    <p className="t-body-sm" style={{ marginTop: 0, fontFamily: 'var(--font-mono)' }}>
                        Last updated: {lastUpdated}
                    </p>
                </div>
            </section>

            <section style={{ padding: '48px 32px 96px' }}>
                <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gridTemplateColumns: '180px 1fr', gap: 48 }}>
                    {/* Sticky TOC */}
                    <aside style={{ position: 'sticky', top: 80, alignSelf: 'flex-start' }}>
                        <div className="t-eyebrow" style={{ marginBottom: 12, fontSize: 10 }}>Sections</div>
                        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, counterReset: 'sec' }}>
                            {sections.map((s, i) => (
                                <li key={s.title} style={{ counterIncrement: 'sec' }}>
                                    <a href={`#sec-${i + 1}`} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--ink-3)', textDecoration: 'none' }}>
                                        <span className="t-mono" style={{ color: 'var(--ink-4)' }}>{String(i + 1).padStart(2, '0')}</span>
                                        <span>{s.title}</span>
                                    </a>
                                </li>
                            ))}
                        </ol>
                    </aside>

                    {/* Content */}
                    <article style={{ minWidth: 0 }}>
                        {intro && (
                            <div className="t-body-lg" style={{ marginBottom: 40, paddingBottom: 32, borderBottom: '1px solid var(--line)' }}>
                                {intro}
                            </div>
                        )}
                        {sections.map((s, i) => (
                            <section key={s.title} id={`sec-${i + 1}`} style={{ marginBottom: 40 }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
                                    <span className="t-mono" style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                                        {String(i + 1).padStart(2, '0')}
                                    </span>
                                    <h2 className="t-h3" style={{ margin: 0 }}>{s.title}</h2>
                                </div>
                                <div className="t-body" style={{ color: 'var(--ink-2)' }}>
                                    {s.body}
                                </div>
                            </section>
                        ))}
                    </article>
                </div>
            </section>

            <Footer />
        </div>
    );
}
