import LegalLayout, { type LegalSection } from '@/components/marketing/LegalLayout';

const SECTIONS: LegalSection[] = [
    {
        title: 'Overview',
        body: <p>TrialShield (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is committed to protecting the privacy of our customers and the end-users whose data is processed through our API. This Privacy Policy explains what data we collect, how we use it, and your rights.</p>,
    },
    {
        title: 'Data we collect',
        body: (
            <>
                <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)', margin: '16px 0 8px' }}>Customer account data</h3>
                <p>When you create an account, we collect your email address and password (hashed). This data is stored in our authentication provider (Supabase) and is used solely for account access.</p>

                <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)', margin: '20px 0 8px' }}>API evaluation data</h3>
                <p>When you send requests to the TrialShield API, we process the following data about your end-users:</p>
                <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <li><strong>Email addresses</strong> — hashed (SHA-256) before storage; used for disposable email detection, breach checks, and duplicate detection</li>
                    <li><strong>IP addresses</strong> — hashed before storage; used for VPN/proxy/TOR detection, geolocation, and abuse reputation checks</li>
                    <li><strong>Phone numbers</strong> — hashed before storage; used for VOIP detection and carrier lookup</li>
                    <li><strong>Device fingerprints</strong> — hashed before storage; used for device uniqueness and headless browser detection</li>
                    <li><strong>Behavioral data</strong> — signup velocity, session patterns; used for bot detection</li>
                </ul>

                <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)', margin: '20px 0 8px' }}>Payment card data (via Stripe integration)</h3>
                <p>If you enable the Stripe integration, TrialShield receives webhook events from Stripe containing card metadata. We store card fingerprints, BINs (hashed), last 4 digits, brand, funding type, country, AVS results, and Stripe Radar level. We <strong>never</strong> store full card numbers, CVCs, or expiration dates.</p>

                <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)', margin: '20px 0 8px' }}>KYC data (when used)</h3>
                <p>If a customer enables KYC verification, we temporarily store the document image and selfie that the end-user submits. Cryptographic hashes are kept for cross-tenant reuse detection. Raw images are <strong>automatically purged after 30 days</strong>.</p>
            </>
        ),
    },
    {
        title: 'How we use data',
        body: (
            <>
                <p>All data processed through the API is used exclusively for:</p>
                <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <li>Calculating risk scores and generating fraud signals</li>
                    <li>Detecting duplicate accounts and coordinated abuse</li>
                    <li>Building identity graphs for abuse network identification</li>
                    <li>Providing analytics and reporting in your dashboard</li>
                </ul>
                <p style={{ marginTop: 12 }}>We do <strong>not</strong> sell, share, or transfer end-user data to any third parties. Data is only used within the context of your TrialShield account.</p>
            </>
        ),
    },
    {
        title: 'Data minimization and hashing',
        body: <p>TrialShield follows a strict data minimization policy. All personally identifiable information (PII) — including email addresses, IP addresses, phone numbers, device fingerprints, and card data — is hashed using SHA-256 before being stored in our database. We do not store raw PII.</p>,
    },
    {
        title: 'GDPR compliance',
        body: (
            <>
                <p>TrialShield is designed to be fully compliant with the General Data Protection Regulation (GDPR). We act as a <strong>Data Processor</strong> on behalf of our customers (the Data Controllers).</p>

                <div className="card" style={{
                    padding: 20, marginTop: 16,
                    background: 'var(--accent-soft)', borderColor: 'var(--accent-line)',
                }}>
                    <div className="t-eyebrow" style={{ color: 'var(--accent-deep)', marginBottom: 12 }}>// Right to erasure</div>
                    <p style={{ margin: 0 }}>
                        We provide a dedicated <strong>DELETE endpoint</strong> for GDPR-compliant user data deletion. Customers can programmatically delete all data associated with a specific end-user from our database.
                    </p>
                    <div className="t-mono" style={{
                        marginTop: 12, padding: '10px 14px',
                        background: 'var(--bg-elev)', borderRadius: 6,
                        fontSize: 12, color: 'var(--ink)',
                        border: '1px solid var(--accent-line)',
                    }}>
                        DELETE /api/v1/users/&#123;userId&#125;<br />
                        Header: X-API-Key: your_api_key
                    </div>
                </div>

                <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)', margin: '20px 0 8px' }}>Right to access</h3>
                <p>End-users can request access to the data TrialShield holds about them through their service provider (our customer). Customers can retrieve user data via the API and provide it to the requesting individual.</p>

                <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)', margin: '20px 0 8px' }}>Data portability</h3>
                <p>Customers can export their data at any time through the TrialShield API. All data is available in standard JSON format.</p>

                <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)', margin: '20px 0 8px' }}>Legal basis for processing</h3>
                <p>TrialShield processes data under the &quot;legitimate interest&quot; legal basis (Article 6(1)(f) GDPR) — specifically, the legitimate interest of preventing fraud and abuse.</p>
            </>
        ),
    },
    {
        title: 'CCPA compliance',
        body: <p>For California residents: TrialShield does not sell personal information. We process data solely for the purpose of fraud detection on behalf of our customers. California residents may exercise their rights under the CCPA by contacting us or their service provider.</p>,
    },
    {
        title: 'Data retention',
        body: <p>Risk evaluation data is retained for 90 days by default, after which it is automatically purged. KYC raw images are purged after 30 days; cryptographic hashes are kept indefinitely for cross-tenant reuse detection. Customers can request immediate deletion at any time using the DELETE endpoint. Account data is retained for the duration of the account and deleted within 30 days of account closure.</p>,
    },
    {
        title: 'Data security',
        body: (
            <>
                <p>We implement the following security measures:</p>
                <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <li>All data in transit is encrypted via TLS 1.3</li>
                    <li>All PII is hashed (SHA-256) before storage</li>
                    <li>API keys are hashed and never stored in plaintext</li>
                    <li>Database access is restricted to service-level credentials</li>
                    <li>Rate limiting and abuse detection on all endpoints</li>
                    <li>Audit logging for all data access operations</li>
                </ul>
            </>
        ),
    },
    {
        title: 'Third-party services',
        body: (
            <>
                <p>TrialShield uses the following third-party services:</p>
                <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <li><strong>Supabase</strong> — database and authentication</li>
                    <li><strong>Vercel</strong> — hosting and deployment</li>
                    <li><strong>Creem</strong> — payment processing for subscriptions</li>
                    <li><strong>Resend</strong> — transactional email delivery</li>
                </ul>
                <p style={{ marginTop: 12 }}>We do not share end-user evaluation data with any of these providers. They only process customer account, billing, and notification data as needed for their services.</p>
            </>
        ),
    },
    {
        title: 'Cookies',
        body: <p>TrialShield uses only essential cookies required for authentication and session management. We do not use tracking cookies, analytics cookies, or advertising cookies.</p>,
    },
    {
        title: 'Changes to this policy',
        body: <p>We may update this Privacy Policy from time to time. We will notify registered users of material changes via email. The &quot;Last updated&quot; date at the top reflects the most recent revision.</p>,
    },
    {
        title: 'Contact',
        body: <p>For privacy-related questions, data deletion requests, or to exercise your rights, contact us at <a href="mailto:tomascorzo1203@gmail.com" style={{ color: 'var(--accent)' }}>tomascorzo1203@gmail.com</a>.</p>,
    },
];

export default function PrivacyPage() {
    return (
        <LegalLayout
            eyebrow="Privacy"
            title="Privacy Policy"
            lastUpdated="March 22, 2026"
            sections={SECTIONS}
        />
    );
}
