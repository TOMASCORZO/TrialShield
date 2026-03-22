export default function PrivacyPage() {
    return (
        <>
            <nav className="landing-nav">
                <a href="/" className="landing-logo">
                    🛡️ <span>TrialShield</span>
                </a>
                <ul className="landing-nav-links">
                    <li><a href="/#features">Features</a></li>
                    <li><a href="/pricing">Pricing</a></li>
                    <li><a href="/docs">Docs</a></li>
                    <li><a href="/login" className="btn btn-secondary btn-sm" style={{ border: 'none', background: 'transparent' }}>Login</a></li>
                    <li><a href="/register" className="btn btn-primary btn-sm">Get Started →</a></li>
                </ul>
            </nav>

            <section style={{ maxWidth: '800px', margin: '0 auto', padding: '80px 24px 60px' }}>
                <h1 style={{ fontSize: '36px', fontWeight: 800, marginBottom: '8px' }}>Privacy Policy</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '40px' }}>Last updated: March 22, 2026</p>

                <div style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '12px' }}>1. Overview</h2>
                    <p>TrialShield (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is committed to protecting the privacy of our customers and the end-users whose data is processed through our API. This Privacy Policy explains what data we collect, how we use it, and your rights.</p>

                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '12px' }}>2. Data We Collect</h2>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '16px', marginBottom: '8px' }}>2.1 Customer Account Data</h3>
                    <p>When you create an account, we collect your email address and password (hashed). This data is stored in our authentication provider (Supabase) and is used solely for account access.</p>

                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '16px', marginBottom: '8px' }}>2.2 API Evaluation Data</h3>
                    <p>When you send requests to the TrialShield API, we process the following data about your end-users:</p>
                    <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
                        <li><strong>Email addresses</strong> — hashed (SHA-256) before storage; used for disposable email detection, breach checks, and duplicate detection</li>
                        <li><strong>IP addresses</strong> — hashed before storage; used for VPN/proxy/TOR detection, geolocation, and abuse reputation checks</li>
                        <li><strong>Phone numbers</strong> — hashed before storage; used for VOIP detection and carrier lookup</li>
                        <li><strong>Device fingerprints</strong> — hashed before storage; used for device uniqueness and headless browser detection</li>
                        <li><strong>Behavioral data</strong> — signup velocity, session patterns; used for bot detection</li>
                    </ul>

                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '16px', marginBottom: '8px' }}>2.3 Payment Card Data (via Stripe Integration)</h3>
                    <p>If you enable the Stripe integration, TrialShield receives webhook events from Stripe containing card metadata. We store:</p>
                    <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
                        <li>Card fingerprint (Stripe&apos;s unique identifier) — hashed</li>
                        <li>BIN (first 6 digits) — hashed</li>
                        <li>Last 4 digits, card brand, funding type, issuing country</li>
                        <li>CVC/AVS verification results</li>
                        <li>Stripe Radar risk level</li>
                    </ul>
                    <p style={{ marginTop: '8px' }}>We <strong>never</strong> store full card numbers, CVCs, or expiration dates. All card fingerprints are hashed before storage.</p>

                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '12px' }}>3. How We Use Data</h2>
                    <p>All data processed through the API is used exclusively for:</p>
                    <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
                        <li>Calculating risk scores and generating fraud signals</li>
                        <li>Detecting duplicate accounts and coordinated abuse</li>
                        <li>Building identity graphs for abuse network identification</li>
                        <li>Providing analytics and reporting in your dashboard</li>
                    </ul>
                    <p style={{ marginTop: '8px' }}>We do <strong>not</strong> sell, share, or transfer end-user data to any third parties. Data is only used within the context of your TrialShield account.</p>

                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '12px' }}>4. Data Minimization and Hashing</h2>
                    <p>TrialShield follows a strict data minimization policy. All personally identifiable information (PII) — including email addresses, IP addresses, phone numbers, device fingerprints, and card data — is hashed using SHA-256 before being stored in our database. We do not store raw PII. This means that even in the event of a data breach, the stored data cannot be used to identify individuals.</p>

                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '12px' }}>5. GDPR Compliance</h2>
                    <p>TrialShield is designed to be fully compliant with the General Data Protection Regulation (GDPR). We act as a <strong>Data Processor</strong> on behalf of our customers (the Data Controllers).</p>

                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '16px', marginBottom: '8px' }}>5.1 Right to Erasure (Right to be Forgotten)</h3>
                    <div className="glass-card" style={{
                        padding: '20px 24px', marginTop: '12px',
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06), rgba(16, 185, 129, 0.02))',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                    }}>
                        <p style={{ margin: 0 }}>
                            We provide a dedicated <strong>DELETE endpoint</strong> for GDPR-compliant user data deletion. Customers can programmatically delete all data associated with a specific end-user from our database by calling:
                        </p>
                        <div style={{
                            marginTop: '12px', padding: '12px 16px',
                            background: 'var(--bg-primary)', borderRadius: '8px',
                            fontFamily: 'monospace', fontSize: '13px',
                        }}>
                            DELETE /api/v1/users/&#123;userId&#125;
                            <br />
                            Header: X-API-Key: your_api_key
                        </div>
                        <p style={{ margin: '12px 0 0', fontSize: '14px' }}>
                            This endpoint permanently removes all risk events, identity anchors, payment fingerprints, device data, and any other records associated with the specified user. The deletion is irreversible and takes effect immediately.
                        </p>
                    </div>

                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '20px', marginBottom: '8px' }}>5.2 Right to Access</h3>
                    <p>End-users can request access to the data TrialShield holds about them through their service provider (our customer). Customers can retrieve user data via the API and provide it to the requesting individual.</p>

                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '20px', marginBottom: '8px' }}>5.3 Data Portability</h3>
                    <p>Customers can export their data at any time through the TrialShield API. All data is available in standard JSON format.</p>

                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '20px', marginBottom: '8px' }}>5.4 Legal Basis for Processing</h3>
                    <p>TrialShield processes data under the &quot;legitimate interest&quot; legal basis (Article 6(1)(f) GDPR) — specifically, the legitimate interest of preventing fraud and abuse. Our customers are responsible for ensuring they have the appropriate legal basis to share end-user data with TrialShield.</p>

                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '12px' }}>6. CCPA Compliance</h2>
                    <p>For California residents: TrialShield does not sell personal information. We process data solely for the purpose of fraud detection on behalf of our customers. California residents may exercise their rights under the CCPA by contacting us or their service provider.</p>

                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '12px' }}>7. Data Retention</h2>
                    <p>Risk evaluation data is retained for 90 days by default, after which it is automatically purged. Customers can request immediate deletion at any time using the DELETE endpoint described above. Account data is retained for the duration of the account and deleted within 30 days of account closure.</p>

                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '12px' }}>8. Data Security</h2>
                    <p>We implement the following security measures:</p>
                    <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
                        <li>All data in transit is encrypted via TLS 1.3</li>
                        <li>All PII is hashed (SHA-256) before storage</li>
                        <li>API keys are hashed and never stored in plaintext</li>
                        <li>Database access is restricted to service-level credentials</li>
                        <li>Rate limiting and abuse detection on all endpoints</li>
                        <li>Audit logging for all data access operations</li>
                    </ul>

                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '12px' }}>9. Third-Party Services</h2>
                    <p>TrialShield uses the following third-party services:</p>
                    <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
                        <li><strong>Supabase</strong> — database and authentication</li>
                        <li><strong>Vercel</strong> — hosting and deployment</li>
                        <li><strong>Creem</strong> (pending approval) — payment processing for subscriptions</li>
                    </ul>
                    <p style={{ marginTop: '8px' }}>We do not share end-user evaluation data with any of these providers. They only process customer account and billing data as needed for their services.</p>

                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '12px' }}>10. Cookies</h2>
                    <p>TrialShield uses only essential cookies required for authentication and session management. We do not use tracking cookies, analytics cookies, or advertising cookies.</p>

                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '12px' }}>11. Changes to This Policy</h2>
                    <p>We may update this Privacy Policy from time to time. We will notify registered users of material changes via email. The &quot;Last updated&quot; date at the top reflects the most recent revision.</p>

                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '12px' }}>12. Contact</h2>
                    <p>For privacy-related questions, data deletion requests, or to exercise your rights, contact us at <a href="mailto:tomas@trialshield.dev" style={{ color: 'var(--color-allow)' }}>tomas@trialshield.dev</a>.</p>
                </div>
            </section>

            <footer className="footer">
                <p>🛡️ <strong>TrialShield</strong> — Stop trial abuse. Protect your revenue.</p>
                <p style={{ marginTop: '8px' }}>
                    <a href="/dashboard">Dashboard</a> · <a href="/docs">API Docs</a> · <a href="/pricing">Pricing</a> · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a>
                </p>
            </footer>
        </>
    );
}
