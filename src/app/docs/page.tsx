export default function DocsPage() {
    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '120px 48px 80px' }}>
            {/* ─── Navigation ──────────────────────────────────── */}
            <nav className="landing-nav">
                <a href="/" className="landing-logo">
                    🛡️ <span>TrialShield</span>
                </a>
                <ul className="landing-nav-links">
                    <li><a href="/#features">Features</a></li>
                    <li><a href="/docs">Docs</a></li>
                    <li><a href="/terms">Terms</a></li>
                    <li><a href="/privacy">Privacy</a></li>
                    <li><a href="/dashboard" className="btn btn-primary btn-sm">Dashboard →</a></li>
                </ul>
            </nav>

            <h1 style={{ fontSize: '36px', marginBottom: '16px' }}>
                <span className="gradient-text">API Documentation</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '48px', fontSize: '18px' }}>
                Complete reference for the TrialShield API v1.
            </p>

            {/* ─── Authentication ──────────────────────────────── */}
            <section style={{ marginBottom: '48px' }}>
                <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>🔑 Authentication</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    All API requests require an API key passed via the <code>X-API-Key</code> header
                    or <code>Authorization: Bearer &lt;key&gt;</code> header.
                </p>
                <div className="code-block">
                    <div className="code-header">
                        <div className="code-dot red"></div>
                        <div className="code-dot yellow"></div>
                        <div className="code-dot green"></div>
                        <span className="code-title">headers</span>
                    </div>
                    <div className="code-body">
                        <pre>{`X-API-Key: ts_your_api_key_here

// or

Authorization: Bearer ts_your_api_key_here`}</pre>
                    </div>
                </div>
            </section>

            {/* ─── POST /verify ────────────────────────────────── */}
            <section style={{ marginBottom: '48px' }}>
                <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>
                    <span className="badge badge-allow" style={{ marginRight: '8px' }}>POST</span>
                    /api/v1/verify
                </h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    Main verification endpoint. Evaluates user risk across all 12 modules and returns an
                    ALLOW/DENY/CHALLENGE decision with a risk score (0-100).
                </p>

                <h3 style={{ fontSize: '16px', marginBottom: '12px', marginTop: '24px' }}>Request Body</h3>
                <table className="data-table" style={{ marginBottom: '24px' }}>
                    <thead>
                        <tr>
                            <th>Field</th>
                            <th>Type</th>
                            <th>Required</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td><code>email</code></td><td>string</td><td>*</td><td>User email address</td></tr>
                        <tr><td><code>phone</code></td><td>string</td><td>*</td><td>Phone number (E.164 format preferred)</td></tr>
                        <tr><td><code>ip</code></td><td>string</td><td>*</td><td>User IP address (auto-detected if not provided)</td></tr>
                        <tr><td><code>deviceFingerprint</code></td><td>object</td><td>No</td><td>Device fingerprint from client SDK</td></tr>
                        <tr><td><code>sessionId</code></td><td>string</td><td>No</td><td>Session identifier for behavioral tracking</td></tr>
                        <tr><td><code>metadata</code></td><td>object</td><td>No</td><td>Additional context (mouseEntropy, keystrokePattern, timeOnPage)</td></tr>
                    </tbody>
                </table>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    * At least one of email, phone, or ip is required.
                </p>

                <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Response</h3>
                <div className="code-block">
                    <div className="code-header">
                        <div className="code-dot red"></div>
                        <div className="code-dot yellow"></div>
                        <div className="code-dot green"></div>
                        <span className="code-title">200 OK</span>
                    </div>
                    <div className="code-body">
                        <pre>{`{
  "id": "uuid",
  "decision": "ALLOW" | "DENY" | "CHALLENGE",
  "riskScore": 0-100,
  "signals": [
    {
      "module": "EMAIL" | "PHONE" | "IP" | "DEVICE" | "BEHAVIOR" | "GRAPH" | "RULES",
      "signal": "DISPOSABLE_EMAIL",
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "description": "Human-readable explanation",
      "value": "optional additional data"
    }
  ],
  "breakdown": {
    "emailScore": 0,
    "phoneScore": 0,
    "ipScore": 0,
    "deviceScore": 0,
    "behaviorScore": 0,
    "graphScore": 0,
    "finalScore": 0,
    "weights": { ... }
  },
  "challenge": {
    "type": "NONE" | "INVISIBLE_CAPTCHA" | "PHONE_VERIFICATION" | "MANUAL_REVIEW",
    "tier": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    "actions": ["require_phone_verification", ...]
  },
  "enrichment": { ... },
  "processingTimeMs": 42,
  "timestamp": "2026-03-11T00:00:00.000Z"
}`}</pre>
                    </div>
                </div>
            </section>

            {/* ─── Other Endpoints ─────────────────────────────── */}
            <section style={{ marginBottom: '48px' }}>
                <h2 style={{ fontSize: '24px', marginBottom: '24px' }}>Other Endpoints</h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {[
                        { method: 'GET', path: '/api/v1/health', desc: 'System health check — module status, external API connectivity' },
                        { method: 'POST', path: '/api/v1/monitor', desc: 'Post-signup event tracking — usage velocity and anomaly detection' },
                        { method: 'POST', path: '/api/v1/feedback', desc: 'Report abuse/legitimate confirmation for model improvement' },
                        { method: 'GET', path: '/api/v1/keys', desc: 'List all API keys' },
                        { method: 'POST', path: '/api/v1/keys', desc: 'Create new API key' },
                        { method: 'GET', path: '/api/v1/audit', desc: 'Query audit logs (GDPR compliant)' },
                        { method: 'GET', path: '/api/v1/stats', desc: 'Dashboard statistics and analytics' },
                        { method: 'GET', path: '/api/v1/users/:id', desc: 'Export user data (GDPR)' },
                        { method: 'DELETE', path: '/api/v1/users/:id', desc: 'Delete user data (GDPR right to erasure)' },
                    ].map((ep) => (
                        <div key={ep.path + ep.method} className="glass-card" style={{
                            padding: '16px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                        }}>
                            <span className={`badge ${ep.method === 'GET' ? 'badge-allow' : ep.method === 'DELETE' ? 'badge-deny' : 'badge-challenge'}`}
                                style={{ minWidth: '70px', justifyContent: 'center' }}>
                                {ep.method}
                            </span>
                            <code style={{ fontSize: '14px', fontWeight: 600, minWidth: '200px' }}>{ep.path}</code>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{ep.desc}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* ─── Client SDK ──────────────────────────────────── */}
            <section style={{ marginBottom: '48px' }}>
                <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>📦 Client SDK</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    Add the TrialShield SDK to your signup page for device fingerprinting and behavioral biometrics.
                </p>
                <div className="code-block">
                    <div className="code-header">
                        <div className="code-dot red"></div>
                        <div className="code-dot yellow"></div>
                        <div className="code-dot green"></div>
                        <span className="code-title">integration.html</span>
                    </div>
                    <div className="code-body">
                        <pre>{`<!-- Add SDK to your page -->
<script src="https://your-api.com/sdk/trialshield.js"></script>

<script>
  // Initialize
  const ts = new TrialShield({
    apiKey: 'ts_your_key',
    apiUrl: 'https://your-api.com'
  });

  // On signup form submit
  document.getElementById('signup-form')
    .addEventListener('submit', async (e) => {
      e.preventDefault();

      const result = await ts.verify({
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value
      });

      if (result.decision === 'ALLOW') {
        // Proceed with signup
        submitSignup();
      } else if (result.decision === 'CHALLENGE') {
        // Show verification step
        showChallenge(result.challenge);
      } else {
        // Block signup
        showError('Unable to create account.');
      }
    });
</script>`}</pre>
                    </div>
                </div>
            </section>

            {/* ─── Signals Reference ───────────────────────────── */}
            <section style={{ marginBottom: '48px' }}>
                <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>🚨 Signal Reference</h2>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Signal</th>
                            <th>Module</th>
                            <th>Severity</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            ['DISPOSABLE_EMAIL', 'EMAIL', 'CRITICAL', 'Temporary/disposable email domain detected'],
                            ['NO_MX_RECORDS', 'EMAIL', 'HIGH', 'Domain has no mail server records'],
                            ['BREACHED_EMAIL', 'EMAIL', 'HIGH', 'Email found in data breaches (HIBP)'],
                            ['VOIP_NUMBER', 'PHONE', 'HIGH', 'Virtual/VOIP phone number detected'],
                            ['VPN_DETECTED', 'IP', 'HIGH', 'VPN or proxy server detected'],
                            ['TOR_EXIT_NODE', 'IP', 'CRITICAL', 'TOR exit node IP address'],
                            ['HEADLESS_BROWSER', 'DEVICE', 'CRITICAL', 'Automated/headless browser detected'],
                            ['MULTI_ACCOUNT_DEVICE', 'DEVICE', 'HIGH', 'Same device used for multiple accounts'],
                            ['HIGH_SIGNUP_VELOCITY_IP', 'BEHAVIOR', 'HIGH', 'Too many signups from same IP'],
                            ['COORDINATED_ATTACK', 'GRAPH', 'CRITICAL', 'Multiple signals suggest organized abuse'],
                        ].map(([signal, mod, sev, desc]) => (
                            <tr key={signal}>
                                <td><code style={{ fontSize: '12px' }}>{signal}</code></td>
                                <td><span className="signal-tag medium">{mod}</span></td>
                                <td><span className={`badge badge-${sev === 'CRITICAL' || sev === 'HIGH' ? 'deny' : 'challenge'}`}>{sev}</span></td>
                                <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{desc}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <footer className="footer" style={{ borderTop: 'none', paddingTop: '0' }}>
                <p>🛡️ <strong>TrialShield</strong> API v1.0.0</p>
            </footer>
        </div>
    );
}
