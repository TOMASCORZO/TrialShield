export default function TermsPage() {
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
                    <li><a href="/terms">Terms</a></li>
                    <li><a href="/privacy">Privacy</a></li>
                    <li><a href="/login" className="btn btn-secondary btn-sm" style={{ border: 'none', background: 'transparent' }}>Login</a></li>
                    <li><a href="/register" className="btn btn-primary btn-sm">Get Started →</a></li>
                </ul>
            </nav>

            <section style={{ maxWidth: '800px', margin: '0 auto', padding: '80px 24px 60px' }}>
                <h1 style={{ fontSize: '36px', fontWeight: 800, marginBottom: '8px' }}>Terms of Service</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '40px' }}>Last updated: March 22, 2026</p>

                <div style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '12px' }}>1. Acceptance of Terms</h2>
                    <p>By accessing or using TrialShield (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. TrialShield is operated by TrialShield (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;).</p>

                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '12px' }}>2. Description of Service</h2>
                    <p>TrialShield provides a real-time API for detecting trial abuse and fraudulent signups. The Service analyzes signals such as email reputation, IP address intelligence, device fingerprinting, behavioral patterns, and payment card data to produce risk scores and recommendations.</p>

                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '12px' }}>3. Account Registration</h2>
                    <p>To use the Service, you must create an account and provide accurate information. You are responsible for maintaining the confidentiality of your account credentials and API keys. You must notify us immediately of any unauthorized use of your account.</p>

                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '12px' }}>4. API Keys and Usage</h2>
                    <p>API keys are issued per account and must not be shared publicly or with unauthorized third parties. You are responsible for all API calls made with your keys. We reserve the right to revoke API keys that are used in violation of these terms or that pose a security risk.</p>

                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '12px' }}>5. Subscriptions and Payment</h2>
                    <p>Paid plans are billed monthly through our payment processor, Creem (pending approval). Subscriptions renew automatically unless canceled before the end of the billing period. Refunds are handled on a case-by-case basis. We reserve the right to change pricing with 30 days&apos; notice.</p>

                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '12px' }}>6. Acceptable Use</h2>
                    <p>You agree not to:</p>
                    <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
                        <li>Use the Service for any unlawful purpose</li>
                        <li>Attempt to reverse-engineer, decompile, or exploit the Service</li>
                        <li>Use the Service to discriminate against individuals based on protected characteristics</li>
                        <li>Exceed your plan&apos;s rate limits through automated means designed to circumvent restrictions</li>
                        <li>Resell or redistribute the Service without written authorization</li>
                    </ul>

                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '12px' }}>7. Data Processing</h2>
                    <p>You acknowledge that the Service processes data you send via the API, including email addresses, IP addresses, device fingerprints, and payment card metadata. You are responsible for ensuring you have the legal basis to share this data with TrialShield. All personally identifiable information (PII) is hashed before storage. See our <a href="/privacy" style={{ color: 'var(--color-allow)' }}>Privacy Policy</a> for full details.</p>

                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '12px' }}>8. Service Availability</h2>
                    <p>We target 99.99% uptime but do not guarantee uninterrupted service. We are not liable for any downtime, data loss, or damages resulting from service interruptions, whether planned or unplanned.</p>

                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '12px' }}>9. Limitation of Liability</h2>
                    <p>The Service is provided &quot;as is&quot; without warranties of any kind. TrialShield is not liable for any indirect, incidental, or consequential damages arising from the use of the Service. Our total liability is limited to the amount you paid in the 12 months preceding the claim.</p>

                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '12px' }}>10. Termination</h2>
                    <p>Either party may terminate at any time. We may suspend or terminate your account immediately if you violate these terms. Upon termination, your API keys will be deactivated and your access to the dashboard will be revoked. You may request deletion of your data per our Privacy Policy.</p>

                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '12px' }}>11. Changes to Terms</h2>
                    <p>We may update these terms at any time. We will notify registered users of material changes via email. Continued use of the Service after changes constitutes acceptance of the updated terms.</p>

                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '12px' }}>12. Contact</h2>
                    <p>For questions about these terms, contact us at <a href="mailto:tomascorzo1203@gmail.com" style={{ color: 'var(--color-allow)' }}>tomascorzo1203@gmail.com</a>.</p>
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
