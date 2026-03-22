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
                            <div className="hero-stat-value">17</div>
                            <div className="hero-stat-label">Detection Modules</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Features Grid ───────────────────────────────── */}
            <section id="features" className="features-section">
                <div className="section-header">
                    <h2><span className="gradient-text">Military-Grade</span> Fraud Intelligence</h2>
                    <p>17 autonomous modules operating in concert. Every signal cross-references every other signal. Abusers have nowhere to hide.</p>
                </div>

                <div className="features-grid">
                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">📧</div>
                        <h3>Email Deep Scan</h3>
                        <p>Cross-reference against 90K+ disposable domains in real-time. MX/SMTP handshake validation, Gmail dot-trick & alias unwinding, HaveIBeenPwned breach correlation. If the inbox is a ghost, we know before you do.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">📱</div>
                        <h3>Telecom Forensics</h3>
                        <p>Real-time carrier interrogation reveals VOIP burners, virtual SIMs, and line-type masking. Country-origin risk profiling catches number farms before the first OTP lands.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">🌐</div>
                        <h3>Network Threat Radar</h3>
                        <p>Pierces through VPNs, proxies, TOR exit nodes, and residential proxy botnets. Impossible-travel detection, ASN reputation scoring, and AbuseIPDB correlation expose even the most sophisticated cloaking setups.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">🖥️</div>
                        <h3>Device DNA</h3>
                        <p>Canvas, WebGL, AudioContext, and font-stack fingerprinting create an immutable device identity with 99.5%+ accuracy. Detects headless browsers, Puppeteer farms, and anti-detect toolkits in milliseconds.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">💳</div>
                        <h3>Stripe Card Fingerprinting</h3>
                        <p>Intercept Stripe webhook events to extract card fingerprints, BIN clusters, and prepaid card signals. When the same Visa ends up on 5 &quot;different&quot; accounts, TrialShield connects the dots instantly. Radar risk fusion included.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">🔑</div>
                        <h3>OAuth Ghost Detection</h3>
                        <p>Analyze OAuth-authenticated accounts to identify single-purpose identities. Freshly minted Google or GitHub accounts used solely to bypass your signup wall are flagged as high-risk phantom accounts before they ever touch your product.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">🧬</div>
                        <h3>Content Fingerprinting</h3>
                        <p>Every file, image, document, or asset your users upload is silently hashed and indexed. When Account B uploads the same portfolio as Account A, TrialShield builds a personalized duplication index that exposes multi-account abusers through their own content.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">🪞</div>
                        <h3>Context Fingerprinting</h3>
                        <p>Every LLM interaction, prompt pattern, and conversation arc is captured and distilled into a behavioral signature. Abusers who spin up new accounts but ask the same questions in the same way are identified through their unique cognitive fingerprint.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">🧠</div>
                        <h3>Behavioral Biometrics</h3>
                        <p>Mouse entropy mapping, keystroke cadence analysis, scroll velocity profiling, and signup flow timing. Bots move like machines. Humans move like humans. We measure the difference in microseconds.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">🕸️</div>
                        <h3>Abuse Graph Engine</h3>
                        <p>Maps hidden relationships between accounts through shared devices, IPs, emails, cards, and content. Visualize entire fraud rings. One compromised node unravels the whole network.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">⚡</div>
                        <h3>Neural Risk Scoring</h3>
                        <p>All 17 modules feed a unified 0-100 risk score with fully explainable decisions. Configurable sensitivity. Shadow mode for safe testing. Self-improving feedback loop that gets smarter with every evaluation.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">🚧</div>
                        <h3>Adaptive Friction</h3>
                        <p>Dynamically escalate challenges based on risk: invisible CAPTCHA, email verification, phone OTP, card micro-auth. Legitimate users feel nothing. Abusers hit a wall that gets higher the harder they push.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">📊</div>
                        <h3>Continuous Surveillance</h3>
                        <p>Post-signup behavioral monitoring with usage velocity tracking, anomaly detection, and auto-quarantine. Catch abusers who pass initial screening but reveal themselves through usage patterns over time.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">🔒</div>
                        <h3>Privacy by Design</h3>
                        <p>Full GDPR/CCPA compliance baked into every layer. SHA-256 PII hashing, data minimization, programmatic delete endpoints, immutable audit trails. Protect your users while protecting your business.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">🏗️</div>
                        <h3>Signal Fusion Hub</h3>
                        <p>100+ enrichment signals from every module converge into a single intelligence feed. Webhook events, historical pattern queries, social graph inference. The more data flows in, the sharper the detection becomes.</p>
                    </div>

                    <div className="glass-card feature-card animate-fade-in">
                        <div className="feature-icon">🚀</div>
                        <h3>Sub-100ms Latency</h3>
                        <p>All 17 modules execute in parallel, not sequentially. Edge-deployed infrastructure delivers verdicts faster than your signup form can render. Zero perceived delay for your users. Instant death for abusers.</p>
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
