export default function HomePage() {
    return (
        <>
            {/* ─── Navigation ──────────────────────────────────── */}
            <nav className="landing-nav">
                <a href="/" className="landing-logo">
                    🛡️ <span>TrialShield</span>
                </a>
                <ul className="landing-nav-links">
                    <li><a href="#features">Features</a></li>
                    <li><a href="/pricing">Pricing</a></li>
                    <li><a href="#api">API</a></li>
                    <li><a href="/docs">Docs</a></li>
                    <li><a href="/login" className="btn btn-secondary btn-sm" style={{ border: 'none', background: 'transparent' }}>Login</a></li>
                    <li><a href="/register" className="btn btn-primary btn-sm">Get Started →</a></li>
                </ul>
            </nav>

            {/* ─── Hero Section ────────────────────────────────── */}
            <section className="hero">
                <div className="hero-content animate-fade-in">
                    <h1>
                        Stop Trial Abuse<br />
                        <span className="gradient-text">Before It Starts</span>
                    </h1>
                    <p>
                        Real-time risk scoring with 100+ signals. Detect disposable emails,
                        VPN/TOR users, device farms, and coordinated attacks — all in under 100ms.
                    </p>
                    <div className="hero-buttons">
                        <a href="/register" className="btn btn-primary">
                            🚀 Get Started Free
                        </a>
                        <a href="/docs" className="btn btn-secondary">
                            📖 API Documentation
                        </a>
                    </div>

                    <div className="hero-stats">
                        <div className="hero-stat">
                            <div className="hero-stat-value">100+</div>
                            <div className="hero-stat-label">Risk Signals</div>
                        </div>
                        <div className="hero-stat">
                            <div className="hero-stat-value">&lt;100ms</div>
                            <div className="hero-stat-label">Latency</div>
                        </div>
                        <div className="hero-stat">
                            <div className="hero-stat-value">90K+</div>
                            <div className="hero-stat-label">Disposable Domains</div>
                        </div>
                        <div className="hero-stat">
                            <div className="hero-stat-value">12</div>
                            <div className="hero-stat-label">Detection Modules</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Features Grid ───────────────────────────────── */}
            <section id="features" className="features-section">
                <div className="section-header">
                    <h2><span className="gradient-text">Enterprise-Grade</span> Detection</h2>
                    <p>12 interconnected modules working in parallel to catch every type of trial abuser.</p>
                </div>

                <div className="features-grid">
                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">📧</div>
                        <h3>Email Intelligence</h3>
                        <p>90K+ disposable domain database, MX/SMTP validation, Gmail dot-trick detection, HaveIBeenPwned breach checks, alias normalization.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">📱</div>
                        <h3>Phone Intelligence</h3>
                        <p>Real carrier lookup, VOIP detection, line type analysis (mobile/VOIP/landline), country risk scoring, number validation.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">🌐</div>
                        <h3>IP & Network Intel</h3>
                        <p>VPN/Proxy/TOR/datacenter detection, AbuseIPDB reputation, impossible travel, ASN analysis, residential proxy detection.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">🖥️</div>
                        <h3>Device Fingerprinting</h3>
                        <p>Canvas, WebGL, audio, font fingerprinting. 99.5%+ accuracy. Headless/Puppeteer detection. Anti-spoofing resistance.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">🧠</div>
                        <h3>Behavioral Analysis</h3>
                        <p>Signup velocity tracking, mouse entropy, keystroke cadence, bot scoring, session anomaly detection.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">🔗</div>
                        <h3>Graph Analysis</h3>
                        <p>Device-to-account clustering, IP/email/phone linking, coordinated attack detection, abuse network identification.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">⚡</div>
                        <h3>ML Risk Scoring</h3>
                        <p>Unified 0-100 score with configurable weights. Explainable AI decisions. Shadow mode for testing. Feedback loop.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">🚧</div>
                        <h3>Adaptive Challenges</h3>
                        <p>Progressive friction: invisible CAPTCHA, email/phone verification, 2FA, card auth. Zero friction for legitimate users.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">📊</div>
                        <h3>Post-Signup Monitoring</h3>
                        <p>Usage velocity tracking, anomaly detection, auto-quarantine, continuous risk re-evaluation.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">🔒</div>
                        <h3>GDPR/CCPA Compliant</h3>
                        <p>PII hashing, data minimization, delete requests, audit logging, consent tracking.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">🏗️</div>
                        <h3>Data Hub</h3>
                        <p>100+ enrichment signals, webhook events, historical queries, social profile inference.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">🚀</div>
                        <h3>Performance & DX</h3>
                        <p>&lt;100ms latency, SDK for browser, rate limiting, 99.99% availability target.</p>
                    </div>
                </div>
            </section>

            {/* ─── API Example ─────────────────────────────────── */}
            <section id="api" className="code-section">
                <div className="section-header">
                    <h2>One API Call, <span className="gradient-text">Complete Protection</span></h2>
                    <p>Integrate in minutes with a single endpoint.</p>
                </div>

                <div className="code-block">
                    <div className="code-header">
                        <div className="code-dot red"></div>
                        <div className="code-dot yellow"></div>
                        <div className="code-dot green"></div>
                        <span className="code-title">verify-user.sh</span>
                    </div>
                    <div className="code-body">
                        <pre>{`curl -X POST https://your-api.com/api/v1/verify \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ts_your_api_key" \\
  -d '{
    "email": "user@example.com",
    "phone": "+1234567890",
    "ip": "203.0.113.42",
    "deviceFingerprint": {
      "id": "fp_abc123..."
    }
  }'`}</pre>
                    </div>
                </div>

                <div className="code-block" style={{ marginTop: '24px' }}>
                    <div className="code-header">
                        <div className="code-dot red"></div>
                        <div className="code-dot yellow"></div>
                        <div className="code-dot green"></div>
                        <span className="code-title">response.json</span>
                    </div>
                    <div className="code-body">
                        <pre>{`{
  "decision": "DENY",
  "riskScore": 87,
  "signals": [
    { "signal": "DISPOSABLE_EMAIL", "severity": "CRITICAL" },
    { "signal": "VPN_DETECTED", "severity": "HIGH" },
    { "signal": "VOIP_NUMBER", "severity": "HIGH" },
    { "signal": "RULE_DISPOSABLE_VPN", "severity": "CRITICAL" }
  ],
  "breakdown": {
    "emailScore": 80,
    "phoneScore": 35,
    "ipScore": 70,
    "deviceScore": 0,
    "behaviorScore": 10,
    "graphScore": 0,
    "finalScore": 87
  },
  "processingTimeMs": 42
}`}</pre>
                    </div>
                </div>
            </section>

            {/* ─── Footer ──────────────────────────────────────── */}
            <footer className="footer">
                <p>
                    🛡️ <strong>TrialShield</strong> — Stop trial abuse. Protect your revenue.
                </p>
                <p style={{ marginTop: '8px' }}>
                    <a href="/dashboard">Dashboard</a> · <a href="/docs">API Docs</a> · <a href="/pricing">Pricing</a> · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a>
                </p>
            </footer>
        </>
    );
}
