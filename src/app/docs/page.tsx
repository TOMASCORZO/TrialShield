'use client';

import { useState } from 'react';
import TopNav from '@/components/marketing/TopNav';
import { SearchIcon, InfoIcon } from '@/components/marketing/Icon';

const NAV_SECTIONS: { title: string; items: string[]; active?: string }[] = [
    { title: 'Get started', items: ['Introduction', 'Quickstart', 'Concepts', 'Architecture'] },
    { title: 'SDKs', items: ['Browser', 'Node.js', 'Go', 'Python', 'Ruby'], active: 'Node.js' },
    { title: 'Guides', items: ['Trial abuse', 'Account linking', 'Bot detection', 'Risk rules', 'Webhooks'] },
    { title: 'API reference', items: ['Authentication', 'Verify', 'Track', 'Monitor', 'KYC sessions'] },
];

const TOC = ['Authentication', 'Verify a request', 'Response', 'Error handling', 'Rate limits'];

const RESPONSE_FIELDS: [string, string, string][] = [
    ['decision', '"ALLOW" | "CHALLENGE" | "DENY"', 'Recommended action based on the risk score and your rules.'],
    ['risk_score', 'number', '0–100. Higher is riskier. 71+ recommended for block.'],
    ['signals', 'Signal[]', 'Triggered risk signals with severity and description.'],
    ['user_id', 'string', 'Stable identifier for this end-user across sessions.'],
    ['processing_time_ms', 'number', 'Total time spent computing the response.'],
];

export default function DocsPage() {
    const [activeTab, setActiveTab] = useState<'Node' | 'Python' | 'curl'>('Node');

    return (
        <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
            <TopNav current="docs" />

            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 220px', minHeight: 'calc(100vh - 60px)' }}>
                {/* Left nav */}
                <aside style={{ borderRight: '1px solid var(--line)', padding: '28px 20px', background: 'var(--bg)' }}>
                    <div style={{ position: 'relative', marginBottom: 24 }}>
                        <input placeholder="Search docs..." style={{ paddingLeft: 32, fontSize: 13 }} />
                        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-4)', display: 'flex' }}>
                            <SearchIcon />
                        </span>
                        <span className="t-mono" style={{
                            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                            fontSize: 10, color: 'var(--ink-4)',
                            border: '1px solid var(--line)', padding: '1px 5px', borderRadius: 3,
                        }}>⌘K</span>
                    </div>
                    {NAV_SECTIONS.map(s => (
                        <div key={s.title} style={{ marginBottom: 24 }}>
                            <div className="t-eyebrow" style={{ marginBottom: 8, fontSize: 10 }}>{s.title}</div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {s.items.map(i => (
                                    <a key={i} href="#" style={{
                                        padding: '5px 8px',
                                        fontSize: 13,
                                        color: i === s.active ? 'var(--accent)' : 'var(--ink-2)',
                                        background: i === s.active ? 'var(--accent-soft)' : 'transparent',
                                        borderRadius: 4,
                                        fontWeight: i === s.active ? 500 : 400,
                                        textDecoration: 'none',
                                    }}>{i}</a>
                                ))}
                            </div>
                        </div>
                    ))}
                </aside>

                {/* Content */}
                <main style={{ padding: '40px 56px', maxWidth: 800 }}>
                    <div className="t-body-sm" style={{ marginBottom: 12, display: 'flex', gap: 6 }}>
                        <span>SDKs</span>
                        <span style={{ color: 'var(--ink-4)' }}>/</span>
                        <span style={{ color: 'var(--ink)' }}>Node.js</span>
                    </div>
                    <h1 className="t-h2" style={{ margin: '0 0 16px' }}>Node.js SDK</h1>
                    <p className="t-body-lg" style={{ marginTop: 0, marginBottom: 32 }}>
                        Verify trial signups on your server before granting access. Real-time risk scoring with full signal attribution.
                    </p>

                    <div style={{
                        display: 'flex', gap: 16, padding: '14px 18px',
                        background: 'var(--accent-soft)', border: '1px solid var(--accent-line)',
                        borderRadius: 8, marginBottom: 32,
                    }}>
                        <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2, display: 'flex' }}>
                            <InfoIcon />
                        </span>
                        <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                            <strong style={{ color: 'var(--ink)' }}>Server-side only.</strong> Your <code className="t-mono" style={{ background: 'rgba(255,255,255,0.6)', padding: '1px 5px', borderRadius: 3 }}>X-API-Key</code> must never reach the browser. Make verification calls from your server before letting trials start.
                        </div>
                    </div>

                    <h2 id="authentication" className="t-h3" style={{ margin: '0 0 12px' }}>Authentication</h2>
                    <p className="t-body" style={{ marginTop: 0, marginBottom: 16 }}>
                        All requests require an API key. Get one from your <a href="/dashboard/settings" style={{ color: 'var(--accent)' }}>dashboard</a> after activating a plan or trial.
                    </p>
                    <div className="code" style={{ padding: '16px 20px', marginBottom: 32 }}>
                        <span style={{ color: '#6B7280' }}>$</span> curl https://trialshield.cc/api/v1/verify {`\\`}<br />
                        {'  '}-H <span style={{ color: '#86EFAC' }}>{'"X-API-Key: ts_your_key"'}</span>
                    </div>

                    <h2 id="verify" className="t-h3" style={{ margin: '0 0 12px' }}>Verify a request</h2>
                    <p className="t-body" style={{ marginTop: 0, marginBottom: 20 }}>
                        Submit user identifiers and context, get back a 0–100 risk score, an array of triggered signals, and a recommendation.
                    </p>

                    <div className="code" style={{ marginBottom: 32 }}>
                        <div style={{ display: 'flex', borderBottom: '1px solid #1F2937', padding: '0 8px' }}>
                            {(['Node', 'Python', 'curl'] as const).map(l => (
                                <button
                                    key={l}
                                    onClick={() => setActiveTab(l)}
                                    style={{
                                        padding: '10px 14px',
                                        background: 'transparent', border: 'none',
                                        color: activeTab === l ? '#fff' : '#6B7280',
                                        borderBottom: '1px solid ' + (activeTab === l ? 'var(--accent)' : 'transparent'),
                                        fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer',
                                    }}
                                >{l}</button>
                            ))}
                        </div>
                        <pre style={{ margin: 0, padding: '20px 24px', fontSize: 13, lineHeight: 1.65, fontFamily: 'var(--font-mono)' }}>
                            {activeTab === 'Node' && (
                                <>
                                    <span className="k">const</span>{' res = '}<span className="k">await</span>{' '}<span className="f">fetch</span>{'('}<span className="s">{'"https://trialshield.cc/api/v1/verify"'}</span>{`, {\n`}
                                    {'  method: '}<span className="s">{'"POST"'}</span>{`,\n`}
                                    {`  headers: {\n`}
                                    {'    '}<span className="s">{'"X-API-Key"'}</span>{': process.env.'}<span className="p">TS_KEY</span>{`,\n`}
                                    {'    '}<span className="s">{'"Content-Type"'}</span>{': '}<span className="s">{'"application/json"'}</span>{`,\n`}
                                    {`  },\n`}
                                    {'  body: '}<span className="f">JSON.stringify</span>{`({\n`}
                                    {'    email: '}<span className="s">{'"user@example.com"'}</span>{`,\n`}
                                    {'    ip:    req.ip,\n'}
                                    {'    user_agent: req.headers['}<span className="s">{'"user-agent"'}</span>{'],\n'}
                                    {'  }),\n'}
                                    {'});\n'}
                                    <span className="k">const</span>{' result = '}<span className="k">await</span>{' res.'}<span className="f">json</span>{'();'}
                                </>
                            )}
                            {activeTab === 'Python' && (
                                <>
                                    <span className="k">import</span>{' requests, os'}{`\n\n`}
                                    {'r = requests.'}<span className="f">post</span>{`(\n`}
                                    {'  '}<span className="s">{'"https://trialshield.cc/api/v1/verify"'}</span>{`,\n`}
                                    {'  headers={'}<span className="s">{'"X-API-Key"'}</span>{': os.environ['}<span className="s">{'"TS_KEY"'}</span>{']},\n'}
                                    {'  json={'}<span className="s">{'"email"'}</span>{': '}<span className="s">{'"user@example.com"'}</span>{', '}<span className="s">{'"ip"'}</span>{': request.remote_addr},\n'}
                                    {')\n'}
                                    {'result = r.'}<span className="f">json</span>{'()'}
                                </>
                            )}
                            {activeTab === 'curl' && (
                                <>
                                    {'curl -X POST '}<span className="s">{'"https://trialshield.cc/api/v1/verify"'}</span>{` \\\n`}
                                    {'  -H '}<span className="s">{'"X-API-Key: $TS_KEY"'}</span>{` \\\n`}
                                    {'  -H '}<span className="s">{'"Content-Type: application/json"'}</span>{` \\\n`}
                                    {'  -d '}<span className="s">{'\'{"email":"user@example.com","ip":"1.2.3.4"}\''}</span>
                                </>
                            )}
                        </pre>
                    </div>

                    <h2 id="response" className="t-h3" style={{ margin: '0 0 12px' }}>Response</h2>
                    <div className="card" style={{ overflow: 'hidden', marginBottom: 32 }}>
                        {RESPONSE_FIELDS.map(([k, t, d], i) => (
                            <div key={k} style={{
                                display: 'grid', gridTemplateColumns: '160px 220px 1fr',
                                padding: '12px 18px', gap: 16, alignItems: 'baseline',
                                borderBottom: i < RESPONSE_FIELDS.length - 1 ? '1px solid var(--line)' : 'none',
                                fontSize: 13,
                            }}>
                                <code className="t-mono" style={{ color: 'var(--accent)', fontSize: 12 }}>{k}</code>
                                <code className="t-mono" style={{ color: 'var(--ink-3)', fontSize: 11 }}>{t}</code>
                                <span style={{ color: 'var(--ink-2)' }}>{d}</span>
                            </div>
                        ))}
                    </div>

                    <h2 id="rate-limits" className="t-h3" style={{ margin: '0 0 12px' }}>Rate limits</h2>
                    <p className="t-body" style={{ marginTop: 0, marginBottom: 16 }}>
                        Default rate limit is 60 requests/minute per API key. Pro plans get 600/min, Enterprise gets 3,000/min. Exceeded requests return <code className="t-mono" style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>429 Too Many Requests</code>.
                    </p>
                </main>

                {/* Right TOC */}
                <aside style={{ borderLeft: '1px solid var(--line)', padding: '40px 24px', background: 'var(--bg)' }}>
                    <div className="t-eyebrow" style={{ marginBottom: 12, fontSize: 10 }}>On this page</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                        {TOC.map((i, idx) => (
                            <a key={i} href={`#${i.toLowerCase().replace(/\s+/g, '-')}`} style={{
                                color: idx === 0 ? 'var(--accent)' : 'var(--ink-3)',
                                textDecoration: 'none',
                            }}>{i}</a>
                        ))}
                    </div>
                </aside>
            </div>
        </div>
    );
}
