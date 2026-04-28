import TopNav from '@/components/marketing/TopNav';
import Footer from '@/components/marketing/Footer';
import { ArrowIcon, ExternalIcon, CopyIcon } from '@/components/marketing/Icon';
import HeroVisual from './_marketing/HeroVisual';

const MODULES = [
    { tag: '01', cat: 'Identity', title: 'Email Intelligence', body: 'MX/SPF/DMARC validation, disposable & subaddressing detection, role-based mailbox flags, free-provider classification.' },
    { tag: '02', cat: 'Identity', title: 'Phone Intelligence', body: 'Carrier lookup, line-type detection (VoIP, prepaid, virtual), country mismatch, SIM-swap heuristics.' },
    { tag: '03', cat: 'Network', title: 'IP & Network', body: 'ASN reputation, datacenter/residential proxy detection, Tor exits, hosting-provider blocklists, geo-velocity.' },
    { tag: '04', cat: 'Network', title: 'Device Fingerprinting', body: 'Stable visitorId across incognito, cookie clears, and VPN switches. Canvas, WebGL, audio, fonts, TLS JA4.' },
    { tag: '05', cat: 'Payment', title: 'Stripe Card Signals', body: 'BIN intelligence, prepaid/gift-card detection, country mismatch with billing, repeated card hashes across accounts.' },
    { tag: '06', cat: 'Identity', title: 'OAuth Ghost', body: 'Spot freshly-minted Google/GitHub/Apple accounts created minutes before signup — a top trial-abuse signal.' },
    { tag: '07', cat: 'Content', title: 'Content Analysis', body: 'Profanity, gibberish, and disposable-pattern detection in names, workspace slugs, and free-form fields.' },
    { tag: '08', cat: 'Context', title: 'Context Signals', body: 'Referrer, UTM coherence, language/timezone mismatch, accept-language vs IP geo, suspicious entry paths.' },
    { tag: '09', cat: 'Behavior', title: 'Behavioral Biometrics', body: 'Keystroke dynamics, mouse entropy, copy-paste detection, time-on-form. Catches automation that fingerprints can\'t.' },
    { tag: '10', cat: 'Behavior', title: 'Graph Analysis', body: 'Account-linking graph: shared device, IP, card, or behavior. Surface the cluster before it converts to abuse.' },
    { tag: '11', cat: 'Scoring', title: 'ML Risk Scoring', body: 'Ensemble model trained on millions of trial signups. 0–100 score with full signal attribution. No black box.' },
    { tag: '12', cat: 'Action', title: 'Adaptive Challenges', body: 'Step up to email OTP, phone verify, or invisible captcha — only when the score warrants it. No friction for real users.' },
    { tag: '13', cat: 'Action', title: 'Post-Signup Monitoring', body: 'Track behavior after the trial starts. Catch second-order abuse: trial extension, feature scraping, mass invites.' },
    { tag: '14', cat: 'Compliance', title: 'GDPR & CCPA', body: 'EU data residency, automatic PII hashing, one-click data export & erasure. SOC 2 Type II and ISO 27001 in flight.' },
    { tag: '15', cat: 'Platform', title: 'Data Hub', body: 'Stream events to Snowflake, BigQuery, S3, or your warehouse. Webhooks for every decision. SQL access to raw signals.' },
    { tag: '16', cat: 'Platform', title: 'Performance & DX', body: '14kb browser SDK, p99 under 100ms globally, SDKs for TS, Go, Python, Ruby, Rust, Java. Sandbox with one CLI command.' },
    { tag: '17', cat: 'Action', title: 'Rules Engine', body: 'Configurable signal weights, shadow mode, A/B testing, versioning, audit log. Tune without redeploying.' },
];

function ModuleGlyph({ tag }: { tag: string }) {
    const n = parseInt(tag, 10);
    return (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="0.5" y="0.5" width="31" height="31" rx="6" stroke="var(--line)" />
            {n % 4 === 0 && <>
                <circle cx="16" cy="16" r="8" stroke="var(--accent)" strokeWidth="1.2" />
                <circle cx="16" cy="16" r="3" fill="var(--accent)" />
            </>}
            {n % 4 === 1 && <>
                <rect x="8" y="8" width="16" height="16" stroke="var(--accent)" strokeWidth="1.2" fill="none" />
                <line x1="8" y1="16" x2="24" y2="16" stroke="var(--accent)" strokeWidth="1" />
                <line x1="16" y1="8" x2="16" y2="24" stroke="var(--accent)" strokeWidth="1" />
            </>}
            {n % 4 === 2 && <>
                <path d="M8 22 L14 14 L18 18 L24 10" stroke="var(--accent)" strokeWidth="1.4" fill="none" />
                <circle cx="14" cy="14" r="1.6" fill="var(--accent)" />
                <circle cx="18" cy="18" r="1.6" fill="var(--accent)" />
                <circle cx="24" cy="10" r="1.6" fill="var(--accent)" />
            </>}
            {n % 4 === 3 && <>
                <path d="M16 7 L24 11 L24 19 L16 25 L8 19 L8 11 Z" stroke="var(--accent)" strokeWidth="1.2" fill="none" />
                <circle cx="16" cy="16" r="2" fill="var(--accent)" />
            </>}
        </svg>
    );
}

const STATS = [
    { v: '<100ms', l: 'p99 API latency' },
    { v: '99.5%', l: 'Returning-device accuracy' },
    { v: '14kb', l: 'Browser SDK gzipped' },
    { v: '100+', l: 'Risk signals' },
];

const LOGO_ROW = ['LINEAR', 'VERCEL', 'PLAID', 'RAMP', 'NOTION', 'RETOOL', 'POSTHOG', 'CHRONOSPHERE'];

export default function HomePage() {
    return (
        <div style={{ background: 'var(--bg)' }}>
            <TopNav current="landing" />

            {/* ─── Hero ─────────────────────────────────────────── */}
            <section style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--line)' }}>
                <div className="grid-bg" style={{
                    position: 'absolute', inset: 0, opacity: 0.5,
                    maskImage: 'linear-gradient(to bottom, black 0%, transparent 80%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 80%)',
                    pointerEvents: 'none',
                }} />
                <div style={{ position: 'relative', maxWidth: 1280, margin: '0 auto', padding: '88px 32px 64px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
                        <span className="tag tag-accent">
                            <span className="dot dot-blue" />
                            New · Account-linking graph 2.0
                        </span>
                        <span className="t-body-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            Read the announcement <ExternalIcon />
                        </span>
                    </div>
                    <h1 className="t-display" style={{ margin: 0, marginBottom: 24, maxWidth: 1020 }}>
                        Stop trial abuse<br />
                        <span style={{ color: 'var(--ink-4)' }}>before it starts.</span>
                    </h1>
                    <p className="t-body-lg" style={{ maxWidth: 620, marginTop: 0, marginBottom: 36 }}>
                        Real-time risk scoring with 100+ signals. Detect disposable emails, VPN/Tor users, device farms, and coordinated attacks — all in under 100ms.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 64, flexWrap: 'wrap' }}>
                        <a href="/register" className="btn btn-accent btn-lg">
                            Start free <ArrowIcon />
                        </a>
                        <a href="/docs" className="btn btn-outline btn-lg">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M5 4l4 3-4 3V4z" fill="currentColor" />
                            </svg>
                            Read the docs
                        </a>
                        <span className="t-body-sm" style={{ marginLeft: 4 }}>
                            · Free trial available on request
                        </span>
                    </div>
                    <HeroVisual />
                </div>
            </section>

            {/* ─── Logo bar ─────────────────────────────────────── */}
            <div className="section-divider" style={{ padding: '32px 0' }}>
                <div className="t-eyebrow" style={{ textAlign: 'center', marginBottom: 24 }}>
                    Trusted by engineering teams
                </div>
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)',
                    alignItems: 'center', justifyItems: 'center',
                    gap: 24, padding: '0 32px',
                    maxWidth: 1280, margin: '0 auto',
                }}>
                    {LOGO_ROW.map(l => (
                        <div key={l} style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 13, fontWeight: 500,
                            color: 'var(--ink-4)',
                            letterSpacing: '0.04em',
                        }}>{l}</div>
                    ))}
                </div>
            </div>

            {/* ─── 17 modules grid ──────────────────────────────── */}
            <section id="platform" style={{ borderBottom: '1px solid var(--line)' }}>
                <div style={{ padding: '64px 32px 32px', textAlign: 'center', borderBottom: '1px solid var(--line)' }}>
                    <div className="t-eyebrow" style={{ color: 'var(--accent)', marginBottom: 16 }}>
                        // 17 detection modules
                    </div>
                    <h2 className="t-h2" style={{ margin: '0 auto 16px', maxWidth: 760 }}>
                        Every signal you need.<br />
                        <span style={{ color: 'var(--ink-4)' }}>One API call.</span>
                    </h2>
                    <p className="t-body-lg" style={{ maxWidth: 560, margin: '0 auto' }}>
                        Identity, network, payment, behavior, and content signals — combined into a single 0–100 risk score in under 100ms.
                    </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', maxWidth: 1280, margin: '0 auto' }}>
                    {MODULES.map((f, i) => (
                        <div key={f.tag} style={{
                            padding: '28px',
                            borderRight: i % 3 !== 2 ? '1px solid var(--line)' : 'none',
                            borderBottom: i < MODULES.length - (MODULES.length % 3 || 3) ? '1px solid var(--line)' : 'none',
                            minHeight: 220,
                            display: 'flex', flexDirection: 'column', gap: 14,
                            background: 'var(--bg)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <ModuleGlyph tag={f.tag} />
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <span className="t-mono" style={{ fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
                                        {f.cat.toUpperCase()}
                                    </span>
                                    <span className="t-eyebrow" style={{ color: 'var(--ink-4)', fontSize: 11 }}>{f.tag}</span>
                                </div>
                            </div>
                            <div style={{ fontSize: 17, fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
                                {f.title}
                            </div>
                            <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-3)', margin: 0 }}>
                                {f.body}
                            </p>
                            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--accent)' }}>
                                <span>Learn more</span>
                                <ArrowIcon />
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ─── Stat band ────────────────────────────────────── */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                borderBottom: '1px solid var(--line)',
                maxWidth: 1280, margin: '0 auto',
            }}>
                {STATS.map((s, i) => (
                    <div key={s.l} style={{
                        padding: '40px 32px',
                        borderRight: i < 3 ? '1px solid var(--line)' : 'none',
                    }}>
                        <div style={{ fontSize: 44, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
                            {s.v}
                        </div>
                        <div className="t-body-sm">{s.l}</div>
                    </div>
                ))}
            </div>

            {/* ─── Code showcase ────────────────────────────────── */}
            <div style={{ padding: '96px 32px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 64, alignItems: 'center' }}>
                    <div>
                        <div className="t-eyebrow" style={{ color: 'var(--accent)', marginBottom: 20 }}>
                            // Drop-in integration
                        </div>
                        <h2 className="t-h2" style={{ marginTop: 0, marginBottom: 20 }}>
                            One script tag.<br />
                            <span style={{ color: 'var(--ink-4)' }}>One server call.</span>
                        </h2>
                        <p className="t-body-lg" style={{ marginTop: 0, marginBottom: 28, maxWidth: 480 }}>
                            Identify the device on the client. Verify on your server before letting a trial start. No form fields. No friction. No false positives.
                        </p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <a href="/docs" className="btn btn-accent">
                                Read the docs <ArrowIcon />
                            </a>
                            <a href="/register" className="btn btn-outline">
                                Get an API key
                            </a>
                        </div>
                    </div>
                    <div className="code" style={{ padding: '20px 0' }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '0 20px 16px 24px', borderBottom: '1px solid #1F2937', marginBottom: 16,
                        }}>
                            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#9CA3AF', fontFamily: 'var(--font-mono)' }}>
                                <span style={{ color: '#fff', borderBottom: '1px solid var(--accent)', paddingBottom: 4 }}>server.ts</span>
                                <span>client.html</span>
                                <span>response.json</span>
                            </div>
                            <span style={{ color: '#6B7280' }}><CopyIcon /></span>
                        </div>
                        <pre style={{ margin: 0, padding: '0 20px', fontSize: 13, lineHeight: 1.7, fontFamily: 'var(--font-mono)' }}>
                            <span className="c">{'// Verify the trial signup before creating the account'}</span>{`\n`}
                            <span className="k">import</span>{' '}<span className="p">{'{ TrialShield }'}</span>{' '}<span className="k">from</span>{' '}<span className="s">{'"@trialshield/node"'}</span>{`;\n\n`}
                            <span className="k">const</span>{' ts = '}<span className="k">new</span>{' '}<span className="f">TrialShield</span>{'(process.env.'}<span className="p">TS_KEY</span>{`);\n\n`}
                            <span className="k">export async function</span>{' '}<span className="f">signup</span>{`(req) {\n`}
                            {'  '}<span className="k">const</span>{' risk = '}<span className="k">await</span>{' ts.'}<span className="f">verify</span>{`({\n`}
                            {'    visitorId: req.body.'}<span className="p">visitorId</span>{`,\n`}
                            {'    email:     req.body.'}<span className="p">email</span>{`,\n`}
                            {`  });\n\n`}
                            {'  '}<span className="k">if</span>{' (risk.score '}<span className="k">{'>'}</span>{' '}<span className="n">75</span>{`) {\n`}
                            {'    '}<span className="k">return</span>{' '}<span className="f">deny</span>{'('}<span className="s">{'"trial_abuse"'}</span>{`);\n`}
                            {`  }\n`}
                            {'  '}<span className="k">return</span>{' '}<span className="f">createAccount</span>{`(req.body);\n`}
                            {`}`}
                        </pre>
                    </div>
                </div>
            </div>

            {/* ─── Customer quote ───────────────────────────────── */}
            <div style={{ padding: '96px 32px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ maxWidth: 880, margin: '0 auto', textAlign: 'center' }}>
                    <div className="t-eyebrow" style={{ color: 'var(--accent)', marginBottom: 24 }}>
                        // Customer story
                    </div>
                    <p style={{
                        fontSize: 32, lineHeight: 1.3, letterSpacing: '-0.02em',
                        margin: 0, fontWeight: 400, color: 'var(--ink)',
                    }}>
                        &ldquo;We were leaking <span style={{ color: 'var(--accent)' }}>$840k a year</span> to trial-cycling. TrialShield caught 94% of it in the first week — and our legitimate signup conversion went <em style={{ fontStyle: 'normal' }}>up</em> because we removed the captcha.&rdquo;
                    </p>
                    <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 999,
                            background: 'linear-gradient(135deg, var(--accent), var(--accent-deep))',
                        }} />
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: 14, fontWeight: 500 }}>Anonymous customer</div>
                            <div className="t-body-sm" style={{ margin: 0 }}>SaaS, beta program</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Final CTA ────────────────────────────────────── */}
            <div style={{ padding: '96px 32px', textAlign: 'center', borderBottom: '1px solid var(--line)', position: 'relative', overflow: 'hidden' }}>
                <div className="grid-bg" style={{
                    position: 'absolute', inset: 0, opacity: 0.4,
                    maskImage: 'radial-gradient(circle at center, black, transparent 70%)',
                    WebkitMaskImage: 'radial-gradient(circle at center, black, transparent 70%)',
                    pointerEvents: 'none',
                }} />
                <div style={{ position: 'relative' }}>
                    <h2 className="t-h1" style={{ margin: '0 auto 16px', maxWidth: 720 }}>
                        Stop trial abuse without<br />
                        <span style={{ color: 'var(--accent)' }}>blocking real users.</span>
                    </h2>
                    <p className="t-body-lg" style={{ maxWidth: 520, margin: '0 auto 32px' }}>
                        Free trial available on request. No credit card. No sales call.
                    </p>
                    <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <a href="/register" className="btn btn-accent btn-lg">
                            Start free <ArrowIcon />
                        </a>
                        <a href="/docs" className="btn btn-outline btn-lg">
                            Read the docs
                        </a>
                    </div>
                </div>
            </div>

            <Footer />
        </div>
    );
}
