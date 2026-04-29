'use client';

// Docs page — single-route, anchored sections.
// Content is derived from the actual handlers in src/app/api/v1/*.

import { useState } from 'react';
import TopNav from '@/components/marketing/TopNav';
import Footer from '@/components/marketing/Footer';
import { SearchIcon, InfoIcon } from '@/components/marketing/Icon';

const NAV_SECTIONS: { title: string; items: { label: string; id: string }[] }[] = [
    {
        title: 'Get started', items: [
            { label: 'Introduction', id: 'introduction' },
            { label: 'Quickstart', id: 'quickstart' },
            { label: 'Authentication', id: 'authentication' },
            { label: 'Plans & limits', id: 'plans' },
        ],
    },
    {
        title: 'Core API', items: [
            { label: 'Verify', id: 'verify' },
            { label: 'Track', id: 'track' },
            { label: 'Monitor', id: 'monitor' },
            { label: 'Feedback', id: 'feedback' },
        ],
    },
    {
        title: 'KYC', items: [
            { label: 'Create session', id: 'kyc-create' },
            { label: 'Get session', id: 'kyc-get' },
        ],
    },
    {
        title: 'Compliance', items: [
            { label: 'GDPR delete', id: 'gdpr-delete' },
            { label: 'Export user', id: 'gdpr-export' },
        ],
    },
    {
        title: 'Reference', items: [
            { label: 'Decisions', id: 'decisions' },
            { label: 'Risk signals', id: 'signals' },
            { label: 'Errors', id: 'errors' },
            { label: 'Rate limits', id: 'rate-limits' },
            { label: 'Health', id: 'health' },
        ],
    },
];

const TOC: { label: string; id: string }[] = [
    { label: 'Introduction', id: 'introduction' },
    { label: 'Quickstart', id: 'quickstart' },
    { label: 'Authentication', id: 'authentication' },
    { label: 'Plans & limits', id: 'plans' },
    { label: 'Verify', id: 'verify' },
    { label: 'Track', id: 'track' },
    { label: 'Monitor', id: 'monitor' },
    { label: 'Feedback', id: 'feedback' },
    { label: 'KYC create', id: 'kyc-create' },
    { label: 'KYC get', id: 'kyc-get' },
    { label: 'GDPR delete', id: 'gdpr-delete' },
    { label: 'Errors', id: 'errors' },
    { label: 'Rate limits', id: 'rate-limits' },
    { label: 'Health', id: 'health' },
];

interface Field { name: string; type: string; required?: boolean; desc: string }

const VERIFY_REQUEST: Field[] = [
    { name: 'email', type: 'string', desc: 'End-user email. At least one of email, phone or ip is required.' },
    { name: 'phone', type: 'string', desc: 'E.164 phone number (e.g. +14155550100).' },
    { name: 'ip', type: 'string', desc: 'End-user IPv4/IPv6. Auto-detected from x-forwarded-for if omitted.' },
    { name: 'deviceFingerprint', type: 'object', desc: 'Optional fingerprint object (id, canvas, webgl, audio, …) from the browser SDK.' },
    { name: 'organizationId', type: 'string', desc: 'Group users so members of the same org are exempt from cross-account checks.' },
    { name: 'oauthProvider', type: 'object', desc: 'OAuth metadata (provider, providerId, createdAt, githubUsername, …) for ghost-account detection.' },
    { name: 'metadata', type: 'object', desc: 'Free-form context. metadata.payment is read for Stripe card signals.' },
];

const VERIFY_RESPONSE: Field[] = [
    { name: 'id', type: 'string', desc: 'Unique evaluation id, used for /feedback and audit lookups.' },
    { name: 'decision', type: '"ALLOW" | "CHALLENGE" | "DENY"', desc: 'Recommended action based on the score and your rules.' },
    { name: 'riskScore', type: 'number', desc: '0–100. Higher is riskier. 71+ recommended for block by default.' },
    { name: 'signals', type: 'RiskSignal[]', desc: 'Triggered signals with module, severity, description, value.' },
    { name: 'breakdown', type: 'ScoreBreakdown', desc: 'Per-module subscores plus the configurable weights used.' },
    { name: 'enrichment', type: 'EnrichmentData', desc: 'Resolved metadata about email, phone, IP, device, behavior, graph.' },
    { name: 'processingTimeMs', type: 'number', desc: 'Total server-side time for this evaluation.' },
    { name: 'timestamp', type: 'string', desc: 'ISO timestamp the response was emitted.' },
];

const TRACK_REQUEST: Field[] = [
    { name: 'userId', type: 'string', required: true, desc: 'Your stable user identifier — the one you want to monitor.' },
    { name: 'activityType', type: 'ActivityType', required: true, desc: 'One of ai_query, file_upload, file_download, project_create, github_link, login, feature_use, export, ...' },
    { name: 'deviceFingerprint', type: 'object', desc: 'Live device fingerprint captured during the session.' },
    { name: 'ip', type: 'string', desc: 'Source IP. Auto-detected if omitted.' },
    { name: 'accountStatus', type: '"trial_active" | "trial_expired" | "paid"', desc: 'Trial state of the user, used to gate enforcement.' },
    { name: 'metadata', type: 'object', desc: 'fileHash, fileName, projectName, githubLink, query, sessionId — fields used for content fingerprinting.' },
];

const TRACK_RESPONSE: Field[] = [
    { name: 'matchScore', type: 'number', desc: '0–100 current match level vs. existing identity clusters.' },
    { name: 'status', type: '"OK" | "WARN" | "REVOKE"', desc: 'Suggested enforcement based on your sensitivity setting.' },
    { name: 'matchedUserId', type: 'string', desc: 'User id this activity was linked to, if a match was found.' },
    { name: 'signals', type: 'RiskSignal[]', desc: 'Reasons the match score moved.' },
    { name: 'contentReuse', type: 'ContentReuseResult[]', desc: 'Files / projects / GitHub links seen on more than one user.' },
    { name: 'enforcement', type: 'EnforcementAction', desc: 'Action taken (or recommended) when status ≠ OK.' },
    { name: 'activityId', type: 'string', desc: 'Id you can pass to follow-up calls.' },
];

const MONITOR_REQUEST: Field[] = [
    { name: 'userId', type: 'string', required: true, desc: 'Stable user id to monitor.' },
    { name: 'eventType', type: '"api_call" | "feature_use" | "login" | "data_export" | "suspicious_action"', required: true, desc: 'Coarse event category.' },
    { name: 'metadata', type: 'object', desc: 'Anything else you want logged with the event.' },
    { name: 'organizationId', type: 'string', desc: 'Override org grouping at runtime.' },
    { name: 'timestamp', type: 'string', desc: 'ISO timestamp. Server uses now() if omitted.' },
];

const KYC_CREATE_REQUEST: Field[] = [
    { name: 'userId', type: 'string', required: true, desc: 'Your end-user id (stored as external_user_id).' },
    { name: 'level', type: '"document_only" | "document_face" | "full"', desc: 'Verification depth. Default: document_face.' },
    { name: 'redirectUrl', type: 'string', desc: 'Where to send the end-user after they complete the flow.' },
    { name: 'metadata', type: 'object', desc: 'Free-form metadata stored on the session.' },
];

const KYC_CREATE_RESPONSE: Field[] = [
    { name: 'sessionId', type: 'string', desc: 'Unique session id.' },
    { name: 'verifyUrl', type: 'string', desc: 'Hosted URL the end-user should open to complete the flow.' },
    { name: 'status', type: '"pending"', desc: 'Initial status.' },
    { name: 'level', type: 'string', desc: 'Verification level for this session.' },
    { name: 'expiresAt', type: 'string', desc: 'ISO timestamp the link stops working.' },
];

const ERRORS = [
    ['MISSING_API_KEY', '401', 'No X-API-Key (or Authorization: Bearer) header was provided.'],
    ['INVALID_API_KEY', '401', 'The key was not found.'],
    ['INACTIVE_API_KEY', '401', 'The key was deactivated.'],
    ['PAYMENT_REQUIRED', '403', 'API key is in pending state. Subscribe or get a free trial approved to activate.'],
    ['SUBSCRIPTION_INACTIVE', '403', 'Subscription is canceled, expired or revoked.'],
    ['TRIAL_EXPIRED', '403', 'Free trial has ended. Subscribe to keep using the API.'],
    ['FEATURE_UNAVAILABLE', '403', 'Endpoint is not available on the current plan.'],
    ['RATE_LIMIT_EXCEEDED', '429', 'Plan rate limit reached. Wait or upgrade.'],
    ['MISSING_INPUT', '400', 'Required body fields were missing or invalid.'],
];

const RATE_LIMITS = [
    ['Free trial', '30 req/min', 'Verify + Track only. Approved manually.'],
    ['Starter', '120 req/min', 'Verify, Track, Monitor, OAuth, Stripe.'],
    ['Pro', '600 req/min', 'Everything in Starter plus Graph and Compliance modules.'],
    ['Enterprise', '3,000 req/min', 'Custom limits and self-hosted edge SDK.'],
];

function FieldsTable({ fields }: { fields: Field[] }) {
    return (
        <div className="card" style={{ overflow: 'hidden', marginBottom: 24 }}>
            {fields.map((f, i) => (
                <div key={f.name} style={{
                    display: 'grid', gridTemplateColumns: '180px 220px 1fr',
                    padding: '12px 18px', gap: 16, alignItems: 'baseline',
                    borderBottom: i < fields.length - 1 ? '1px solid var(--line)' : 'none',
                    fontSize: 13,
                }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <code className="t-mono" style={{ color: 'var(--accent)', fontSize: 12 }}>{f.name}</code>
                        {f.required && <span className="tag tag-amber" style={{ fontSize: 9, padding: '1px 5px' }}>required</span>}
                    </div>
                    <code className="t-mono" style={{ color: 'var(--ink-3)', fontSize: 11 }}>{f.type}</code>
                    <span style={{ color: 'var(--ink-2)' }}>{f.desc}</span>
                </div>
            ))}
        </div>
    );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
    return (
        <div className="code" style={{ padding: '16px 20px', marginBottom: 24, fontFamily: 'var(--font-mono)' }}>
            {children}
        </div>
    );
}

function MultiTabCode({ tabs, content }: {
    tabs: string[];
    content: Record<string, React.ReactNode>;
}) {
    const [active, setActive] = useState(tabs[0]);
    return (
        <div className="code" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #1F2937', padding: '0 8px' }}>
                {tabs.map(t => (
                    <button
                        key={t}
                        onClick={() => setActive(t)}
                        style={{
                            padding: '10px 14px',
                            background: 'transparent', border: 'none',
                            color: active === t ? '#fff' : '#6B7280',
                            borderBottom: '1px solid ' + (active === t ? 'var(--accent)' : 'transparent'),
                            fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer',
                        }}
                    >{t}</button>
                ))}
            </div>
            <pre style={{ margin: 0, padding: '20px 24px', fontSize: 13, lineHeight: 1.65, fontFamily: 'var(--font-mono)' }}>
                {content[active]}
            </pre>
        </div>
    );
}

export default function DocsPage() {
    return (
        <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
            <TopNav current="docs" />

            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 220px' }}>
                {/* ─── Left nav ──────────────────────────────────── */}
                <aside style={{
                    borderRight: '1px solid var(--line)', padding: '28px 20px',
                    background: 'var(--bg)',
                    position: 'sticky', top: 60, alignSelf: 'flex-start',
                    height: 'calc(100vh - 60px)', overflow: 'auto',
                }}>
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
                                    <a key={i.id} href={`#${i.id}`} style={{
                                        padding: '5px 8px',
                                        fontSize: 13,
                                        color: 'var(--ink-2)',
                                        borderRadius: 4,
                                        textDecoration: 'none',
                                    }}>{i.label}</a>
                                ))}
                            </div>
                        </div>
                    ))}
                </aside>

                {/* ─── Content ───────────────────────────────────── */}
                <main style={{ padding: '40px 56px', maxWidth: 880, margin: '0 auto' }}>
                    <div className="t-body-sm" style={{ marginBottom: 12, display: 'flex', gap: 6 }}>
                        <span>API reference</span>
                        <span style={{ color: 'var(--ink-4)' }}>/</span>
                        <span style={{ color: 'var(--ink)' }}>v1</span>
                    </div>
                    <h1 className="t-h2" style={{ margin: '0 0 16px' }}>TrialShield API v1</h1>
                    <p className="t-body-lg" style={{ marginTop: 0, marginBottom: 32 }}>
                        Real-time risk scoring for trial signups, post-signup activity, and KYC verification.
                        All endpoints accept and return JSON.
                    </p>

                    {/* INTRODUCTION */}
                    <section id="introduction" style={{ marginBottom: 48, scrollMarginTop: 24 }}>
                        <h2 className="t-h3" style={{ margin: '0 0 12px' }}>Introduction</h2>
                        <p className="t-body" style={{ margin: '0 0 16px' }}>
                            TrialShield combines 100+ identity, network, payment, behavior, and content signals into a single
                            0–100 risk score. The most common integration is two API calls: <code className="t-mono" style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>/v1/verify</code> at signup, and <code className="t-mono" style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>/v1/track</code> for continuous monitoring while the user is on a trial.
                        </p>
                        <p className="t-body" style={{ margin: 0 }}>
                            All endpoints are hosted at <code className="t-mono" style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>https://trialshield.cc/api/v1</code>.
                        </p>
                    </section>

                    {/* QUICKSTART */}
                    <section id="quickstart" style={{ marginBottom: 48, scrollMarginTop: 24 }}>
                        <h2 className="t-h3" style={{ margin: '0 0 12px' }}>Quickstart</h2>
                        <ol style={{ paddingLeft: 20, marginTop: 0, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <li><a href="/register" style={{ color: 'var(--accent)' }}>Create an account</a> and request a free trial.</li>
                            <li>Once approved, copy your API key from <a href="/dashboard/settings" style={{ color: 'var(--accent)' }}>Dashboard → Settings</a>.</li>
                            <li>Send your first verification:</li>
                        </ol>
                        <CodeBlock>
                            <span style={{ color: '#6B7280' }}>$</span>{' '}
                            <span style={{ color: '#FDE68A' }}>curl</span>{' '}
                            <span style={{ color: '#86EFAC' }}>{'https://trialshield.cc/api/v1/verify'}</span>{` \\\n`}
                            {'  -H '}<span style={{ color: '#86EFAC' }}>{'"X-API-Key: $TS_KEY"'}</span>{` \\\n`}
                            {'  -H '}<span style={{ color: '#86EFAC' }}>{'"Content-Type: application/json"'}</span>{` \\\n`}
                            {'  -d '}<span style={{ color: '#86EFAC' }}>{'\'{"email":"user@example.com","ip":"1.2.3.4"}\''}</span>
                        </CodeBlock>
                    </section>

                    {/* AUTHENTICATION */}
                    <section id="authentication" style={{ marginBottom: 48, scrollMarginTop: 24 }}>
                        <h2 className="t-h3" style={{ margin: '0 0 12px' }}>Authentication</h2>
                        <p className="t-body" style={{ margin: '0 0 16px' }}>
                            Every customer-facing endpoint accepts the API key in either header. Pick one — both are equivalent.
                        </p>
                        <CodeBlock>
                            X-API-Key: <span style={{ color: '#FDE68A' }}>ts_xxx...</span>{`\n`}
                            <span style={{ color: '#6B7280' }}># or</span>{`\n`}
                            Authorization: Bearer <span style={{ color: '#FDE68A' }}>ts_xxx...</span>
                        </CodeBlock>
                        <div style={{
                            display: 'flex', gap: 16, padding: '14px 18px',
                            background: 'var(--accent-soft)', border: '1px solid var(--accent-line)',
                            borderRadius: 8, marginBottom: 16,
                        }}>
                            <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2, display: 'flex' }}><InfoIcon /></span>
                            <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                                <strong style={{ color: 'var(--ink)' }}>Server-side only.</strong> Your API key must never reach the browser. Always call from a backend.
                            </div>
                        </div>
                    </section>

                    {/* PLANS */}
                    <section id="plans" style={{ marginBottom: 48, scrollMarginTop: 24 }}>
                        <h2 className="t-h3" style={{ margin: '0 0 12px' }}>Plans &amp; limits</h2>
                        <p className="t-body" style={{ margin: '0 0 16px' }}>
                            Each plan unlocks a feature set and a per-key rate limit. The check happens once per request, before your handler runs.
                        </p>
                        <div className="card" style={{ overflow: 'hidden' }}>
                            <div style={{
                                display: 'grid', gridTemplateColumns: '160px 140px 1fr',
                                padding: '12px 18px', background: 'var(--bg-sunken)',
                                fontFamily: 'var(--font-mono)', fontSize: 11,
                                color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em',
                                borderBottom: '1px solid var(--line)',
                            }}>
                                <span>Plan</span>
                                <span>Rate limit</span>
                                <span>Features</span>
                            </div>
                            {RATE_LIMITS.map(([plan, limit, features], i) => (
                                <div key={plan} style={{
                                    display: 'grid', gridTemplateColumns: '160px 140px 1fr',
                                    padding: '12px 18px', fontSize: 13,
                                    borderBottom: i < RATE_LIMITS.length - 1 ? '1px solid var(--line)' : 'none',
                                }}>
                                    <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{plan}</span>
                                    <code className="t-mono" style={{ color: 'var(--ink-2)', fontSize: 12 }}>{limit}</code>
                                    <span style={{ color: 'var(--ink-2)' }}>{features}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* VERIFY */}
                    <section id="verify" style={{ marginBottom: 56, scrollMarginTop: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                            <span className="tag" style={{ background: 'var(--green-soft)', color: 'var(--green)', borderColor: 'var(--green-line)' }}>POST</span>
                            <code className="t-mono" style={{ fontSize: 14, color: 'var(--ink)' }}>/v1/verify</code>
                        </div>
                        <h2 className="t-h3" style={{ margin: '0 0 12px' }}>Verify</h2>
                        <p className="t-body" style={{ margin: '0 0 20px' }}>
                            Score a signup or login event. Returns a 0–100 risk score, a recommended decision, and the signals that fired.
                            At least one of <code className="t-mono" style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>email</code>, <code className="t-mono" style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>phone</code> or <code className="t-mono" style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>ip</code> is required.
                        </p>

                        <h4 className="t-eyebrow" style={{ margin: '24px 0 10px' }}>Request body</h4>
                        <FieldsTable fields={VERIFY_REQUEST} />

                        <h4 className="t-eyebrow" style={{ margin: '24px 0 10px' }}>Response</h4>
                        <FieldsTable fields={VERIFY_RESPONSE} />

                        <h4 className="t-eyebrow" style={{ margin: '24px 0 10px' }}>Example</h4>
                        <MultiTabCode
                            tabs={['Node', 'Python', 'curl']}
                            content={{
                                Node: (
                                    <>
                                        <span className="k">const</span>{' res = '}<span className="k">await</span>{' '}<span className="f">fetch</span>{'('}<span className="s">{'"https://trialshield.cc/api/v1/verify"'}</span>{`, {\n`}
                                        {'  method: '}<span className="s">{'"POST"'}</span>{`,\n`}
                                        {'  headers: {\n'}
                                        {'    '}<span className="s">{'"X-API-Key"'}</span>{': process.env.'}<span className="p">TS_KEY</span>{`,\n`}
                                        {'    '}<span className="s">{'"Content-Type"'}</span>{': '}<span className="s">{'"application/json"'}</span>{`,\n`}
                                        {'  },\n'}
                                        {'  body: '}<span className="f">JSON.stringify</span>{`({\n`}
                                        {'    email:    '}<span className="s">{'"user@example.com"'}</span>{`,\n`}
                                        {'    ip:       req.ip,\n'}
                                        {'    metadata: { signup_source: '}<span className="s">{'"organic"'}</span>{` },\n`}
                                        {'  }),\n'}
                                        {'});\n'}
                                        <span className="k">const</span>{' result = '}<span className="k">await</span>{' res.'}<span className="f">json</span>{'();\n'}
                                        <span className="k">if</span>{' (result.decision === '}<span className="s">{'"DENY"'}</span>{') '}<span className="k">throw new</span>{' '}<span className="f">Error</span>{'('}<span className="s">{'"trial_abuse"'}</span>{');'}
                                    </>
                                ),
                                Python: (
                                    <>
                                        <span className="k">import</span>{' requests, os'}{`\n\n`}
                                        {'r = requests.'}<span className="f">post</span>{`(\n`}
                                        {'  '}<span className="s">{'"https://trialshield.cc/api/v1/verify"'}</span>{`,\n`}
                                        {'  headers={'}<span className="s">{'"X-API-Key"'}</span>{': os.environ['}<span className="s">{'"TS_KEY"'}</span>{']},\n'}
                                        {'  json={'}<span className="s">{'"email"'}</span>{': '}<span className="s">{'"user@example.com"'}</span>{', '}<span className="s">{'"ip"'}</span>{': request.remote_addr},\n'}
                                        {')\n'}
                                        {'result = r.'}<span className="f">json</span>{'()\n'}
                                        <span className="k">if</span>{' result['}<span className="s">{'"decision"'}</span>{'] == '}<span className="s">{'"DENY"'}</span>{':\n'}
                                        {'  '}<span className="k">raise</span>{' '}<span className="f">Exception</span>{'('}<span className="s">{'"trial_abuse"'}</span>{')'}
                                    </>
                                ),
                                curl: (
                                    <>
                                        {'curl -X POST '}<span className="s">{'"https://trialshield.cc/api/v1/verify"'}</span>{` \\\n`}
                                        {'  -H '}<span className="s">{'"X-API-Key: $TS_KEY"'}</span>{` \\\n`}
                                        {'  -H '}<span className="s">{'"Content-Type: application/json"'}</span>{` \\\n`}
                                        {'  -d '}<span className="s">{'\'{"email":"user@example.com","ip":"1.2.3.4"}\''}</span>
                                    </>
                                ),
                            }}
                        />
                    </section>

                    {/* TRACK */}
                    <section id="track" style={{ marginBottom: 56, scrollMarginTop: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                            <span className="tag" style={{ background: 'var(--green-soft)', color: 'var(--green)', borderColor: 'var(--green-line)' }}>POST</span>
                            <code className="t-mono" style={{ fontSize: 14, color: 'var(--ink)' }}>/v1/track</code>
                        </div>
                        <h2 className="t-h3" style={{ margin: '0 0 12px' }}>Track</h2>
                        <p className="t-body" style={{ margin: '0 0 20px' }}>
                            Continuous monitoring after signup. Pass any user activity (file upload, AI query, GitHub link, login)
                            and TrialShield resolves identity, fingerprints content, and surfaces duplicate accounts that share the same device,
                            IP, or content.
                        </p>

                        <h4 className="t-eyebrow" style={{ margin: '24px 0 10px' }}>Request body</h4>
                        <FieldsTable fields={TRACK_REQUEST} />

                        <h4 className="t-eyebrow" style={{ margin: '24px 0 10px' }}>Response</h4>
                        <FieldsTable fields={TRACK_RESPONSE} />
                    </section>

                    {/* MONITOR */}
                    <section id="monitor" style={{ marginBottom: 56, scrollMarginTop: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                            <span className="tag" style={{ background: 'var(--green-soft)', color: 'var(--green)', borderColor: 'var(--green-line)' }}>POST</span>
                            <code className="t-mono" style={{ fontSize: 14, color: 'var(--ink)' }}>/v1/monitor</code>
                        </div>
                        <h2 className="t-h3" style={{ margin: '0 0 12px' }}>Monitor</h2>
                        <p className="t-body" style={{ margin: '0 0 20px' }}>
                            Lightweight event log. Useful when you want to feed second-order signals (data exports, suspicious actions) without running the full Track pipeline.
                        </p>

                        <h4 className="t-eyebrow" style={{ margin: '24px 0 10px' }}>Request body</h4>
                        <FieldsTable fields={MONITOR_REQUEST} />
                    </section>

                    {/* FEEDBACK */}
                    <section id="feedback" style={{ marginBottom: 56, scrollMarginTop: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                            <span className="tag" style={{ background: 'var(--green-soft)', color: 'var(--green)', borderColor: 'var(--green-line)' }}>POST</span>
                            <code className="t-mono" style={{ fontSize: 14, color: 'var(--ink)' }}>/v1/feedback</code>
                        </div>
                        <h2 className="t-h3" style={{ margin: '0 0 12px' }}>Feedback</h2>
                        <p className="t-body" style={{ margin: '0 0 20px' }}>
                            Tell us when our decision was wrong (false positive / false negative). The signal flows back into the model.
                        </p>
                        <FieldsTable fields={[
                            { name: 'evaluationId', type: 'string', required: true, desc: 'The id from a previous verify response.' },
                            { name: 'isAbuser', type: 'boolean', required: true, desc: 'true if the user turned out to be abusive.' },
                            { name: 'notes', type: 'string', desc: 'Free-form context for the review team.' },
                        ]} />
                    </section>

                    {/* KYC */}
                    <section id="kyc-create" style={{ marginBottom: 56, scrollMarginTop: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                            <span className="tag" style={{ background: 'var(--green-soft)', color: 'var(--green)', borderColor: 'var(--green-line)' }}>POST</span>
                            <code className="t-mono" style={{ fontSize: 14, color: 'var(--ink)' }}>/v1/kyc/session</code>
                        </div>
                        <h2 className="t-h3" style={{ margin: '0 0 12px' }}>Create KYC session</h2>
                        <p className="t-body" style={{ margin: '0 0 20px' }}>
                            Generate a hosted verification link for a specific end-user. The link expires after 30 minutes.
                            Document images are purged after 30 days; cryptographic hashes are kept indefinitely for cross-tenant reuse detection.
                        </p>
                        <h4 className="t-eyebrow" style={{ margin: '24px 0 10px' }}>Request body</h4>
                        <FieldsTable fields={KYC_CREATE_REQUEST} />
                        <h4 className="t-eyebrow" style={{ margin: '24px 0 10px' }}>Response</h4>
                        <FieldsTable fields={KYC_CREATE_RESPONSE} />
                    </section>

                    <section id="kyc-get" style={{ marginBottom: 56, scrollMarginTop: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                            <span className="tag" style={{ background: 'var(--accent-soft)', color: 'var(--accent-deep)', borderColor: 'var(--accent-line)' }}>GET</span>
                            <code className="t-mono" style={{ fontSize: 14, color: 'var(--ink)' }}>/v1/kyc/session/&#123;id&#125;</code>
                        </div>
                        <h2 className="t-h3" style={{ margin: '0 0 12px' }}>Get KYC session</h2>
                        <p className="t-body" style={{ margin: '0 0 16px' }}>
                            Poll for the result of a KYC session. Returns <code className="t-mono" style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>status</code>, <code className="t-mono" style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>level</code>, the full <code className="t-mono" style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>result</code> (decision, score, signals) once status is <code className="t-mono" style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>completed</code>, plus timestamps.
                        </p>
                    </section>

                    {/* GDPR */}
                    <section id="gdpr-delete" style={{ marginBottom: 56, scrollMarginTop: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                            <span className="tag" style={{ background: 'var(--red-soft)', color: 'var(--red)', borderColor: 'var(--red-line)' }}>DELETE</span>
                            <code className="t-mono" style={{ fontSize: 14, color: 'var(--ink)' }}>/v1/users/&#123;id&#125;</code>
                        </div>
                        <h2 className="t-h3" style={{ margin: '0 0 12px' }}>Delete a user (GDPR / CCPA)</h2>
                        <p className="t-body" style={{ margin: '0 0 16px' }}>
                            Erase every record we hold for an end-user — risk events, device graph entries, monitoring events, identity anchors, and the user row itself.
                            Resolves <code className="t-mono" style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>id</code> as a TrialShield user UUID by default; pass <code className="t-mono" style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>?type=email</code> or <code className="t-mono" style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>?type=phone</code> to look up by hash.
                        </p>
                        <p className="t-body" style={{ margin: '0 0 16px' }}>
                            <strong>Tenant-scoped:</strong> the user must have at least one risk event tied to one of your API keys. Cross-tenant deletes are rejected with 403.
                        </p>
                        <CodeBlock>
                            curl -X DELETE <span style={{ color: '#86EFAC' }}>{'"https://trialshield.cc/api/v1/users/{userId}"'}</span>{` \\\n`}
                            {'  -H '}<span style={{ color: '#86EFAC' }}>{'"X-API-Key: $TS_KEY"'}</span>
                        </CodeBlock>
                    </section>

                    <section id="gdpr-export" style={{ marginBottom: 56, scrollMarginTop: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                            <span className="tag" style={{ background: 'var(--accent-soft)', color: 'var(--accent-deep)', borderColor: 'var(--accent-line)' }}>GET</span>
                            <code className="t-mono" style={{ fontSize: 14, color: 'var(--ink)' }}>/v1/users/&#123;id&#125;</code>
                        </div>
                        <h2 className="t-h3" style={{ margin: '0 0 12px' }}>Export a user (GDPR)</h2>
                        <p className="t-body" style={{ margin: 0 }}>
                            Returns the user record plus all stored events, anchors and risk evaluations as JSON. Same tenant scoping as DELETE.
                        </p>
                    </section>

                    {/* DECISIONS */}
                    <section id="decisions" style={{ marginBottom: 56, scrollMarginTop: 24 }}>
                        <h2 className="t-h3" style={{ margin: '0 0 12px' }}>Decisions</h2>
                        <p className="t-body" style={{ margin: '0 0 16px' }}>
                            Default thresholds. Override per API key from <a href="/dashboard/settings" style={{ color: 'var(--accent)' }}>Settings → Module weights</a>.
                        </p>
                        <div className="card" style={{ overflow: 'hidden' }}>
                            {[
                                ['ALLOW', '0–30', 'var(--green)', 'var(--green-soft)', 'Low risk. No friction. Default outcome for organic users.'],
                                ['CHALLENGE', '31–70', 'var(--amber)', 'var(--amber-soft)', 'Step up: email OTP, phone verify, or invisible captcha.'],
                                ['DENY', '71–100', 'var(--red)', 'var(--red-soft)', 'Block + flag for review. The signup or login is rejected.'],
                            ].map(([d, range, color, bg, desc], i) => (
                                <div key={d} style={{
                                    display: 'grid', gridTemplateColumns: '120px 100px 1fr',
                                    padding: '14px 18px', alignItems: 'center', gap: 16,
                                    borderBottom: i < 2 ? '1px solid var(--line)' : 'none',
                                }}>
                                    <span className="tag" style={{ background: bg, color, borderColor: color, alignSelf: 'flex-start' }}>{d}</span>
                                    <code className="t-mono" style={{ color: 'var(--ink-2)', fontSize: 12 }}>{range}</code>
                                    <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{desc}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* SIGNALS */}
                    <section id="signals" style={{ marginBottom: 56, scrollMarginTop: 24 }}>
                        <h2 className="t-h3" style={{ margin: '0 0 12px' }}>Risk signals</h2>
                        <p className="t-body" style={{ margin: '0 0 16px' }}>
                            Every <code className="t-mono" style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>signals[]</code> entry has a <code className="t-mono" style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>module</code>, <code className="t-mono" style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>signal</code> name, <code className="t-mono" style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>severity</code>, and a human <code className="t-mono" style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>description</code>.
                        </p>
                        <FieldsTable fields={[
                            { name: 'module', type: '"EMAIL" | "PHONE" | "IP" | "DEVICE" | "BEHAVIOR" | "GRAPH" | "OAUTH" | "RULES"', desc: 'Which detection module raised the signal.' },
                            { name: 'signal', type: 'string', desc: 'Slug of the specific detector (e.g. DISPOSABLE_EMAIL, VPN_DETECTED, DEVICE_REUSED).' },
                            { name: 'severity', type: '"LOW" | "MEDIUM" | "HIGH" | "CRITICAL"', desc: 'Severity weight applied when computing the score.' },
                            { name: 'description', type: 'string', desc: 'Human-readable explanation, safe to show in support tools.' },
                            { name: 'value', type: 'string | number | boolean', desc: 'Optional payload (e.g. detected ASN, BIN, country).' },
                        ]} />
                    </section>

                    {/* ERRORS */}
                    <section id="errors" style={{ marginBottom: 56, scrollMarginTop: 24 }}>
                        <h2 className="t-h3" style={{ margin: '0 0 12px' }}>Errors</h2>
                        <p className="t-body" style={{ margin: '0 0 16px' }}>
                            Errors come back with an <code className="t-mono" style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>error</code> string and a stable machine-readable <code className="t-mono" style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>code</code>.
                        </p>
                        <div className="card" style={{ overflow: 'hidden' }}>
                            <div style={{
                                display: 'grid', gridTemplateColumns: '220px 80px 1fr',
                                padding: '12px 18px', background: 'var(--bg-sunken)',
                                fontFamily: 'var(--font-mono)', fontSize: 11,
                                color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em',
                                borderBottom: '1px solid var(--line)',
                            }}>
                                <span>Code</span>
                                <span>HTTP</span>
                                <span>When</span>
                            </div>
                            {ERRORS.map(([code, http, desc], i) => (
                                <div key={code} style={{
                                    display: 'grid', gridTemplateColumns: '220px 80px 1fr',
                                    padding: '12px 18px', fontSize: 13,
                                    borderBottom: i < ERRORS.length - 1 ? '1px solid var(--line)' : 'none',
                                }}>
                                    <code className="t-mono" style={{ color: 'var(--accent)', fontSize: 12 }}>{code}</code>
                                    <code className="t-mono" style={{ color: 'var(--ink-2)', fontSize: 12 }}>{http}</code>
                                    <span style={{ color: 'var(--ink-2)' }}>{desc}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* RATE LIMITS */}
                    <section id="rate-limits" style={{ marginBottom: 56, scrollMarginTop: 24 }}>
                        <h2 className="t-h3" style={{ margin: '0 0 12px' }}>Rate limits</h2>
                        <p className="t-body" style={{ margin: '0 0 16px' }}>
                            Every key has a per-minute window. The current limit comes from your plan unless you have an override from sales.
                            Exceeded requests return <code className="t-mono" style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>429</code> with the code <code className="t-mono" style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>RATE_LIMIT_EXCEEDED</code>. The response includes <code className="t-mono" style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>X-RateLimit-Limit</code> so you can back off.
                        </p>
                    </section>

                    {/* HEALTH */}
                    <section id="health" style={{ marginBottom: 56, scrollMarginTop: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                            <span className="tag" style={{ background: 'var(--accent-soft)', color: 'var(--accent-deep)', borderColor: 'var(--accent-line)' }}>GET</span>
                            <code className="t-mono" style={{ fontSize: 14, color: 'var(--ink)' }}>/v1/health</code>
                        </div>
                        <h2 className="t-h3" style={{ margin: '0 0 12px' }}>Health</h2>
                        <p className="t-body" style={{ margin: '0 0 16px' }}>
                            Unauthenticated. Returns <code className="t-mono" style={{ background: 'var(--bg-sunken)', padding: '1px 5px', borderRadius: 3 }}>{`{"status":"ok"}`}</code> when the API is reachable. Use it as your uptime-monitor target.
                        </p>
                    </section>
                </main>

                {/* ─── Right TOC ─────────────────────────────────── */}
                <aside style={{
                    borderLeft: '1px solid var(--line)', padding: '40px 24px',
                    background: 'var(--bg)',
                    position: 'sticky', top: 60, alignSelf: 'flex-start',
                    height: 'calc(100vh - 60px)', overflow: 'auto',
                }}>
                    <div className="t-eyebrow" style={{ marginBottom: 12, fontSize: 10 }}>On this page</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                        {TOC.map(item => (
                            <a key={item.id} href={`#${item.id}`} style={{ color: 'var(--ink-3)', textDecoration: 'none' }}>
                                {item.label}
                            </a>
                        ))}
                    </div>
                </aside>
            </div>

            <Footer />
        </div>
    );
}
