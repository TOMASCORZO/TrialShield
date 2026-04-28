import LegalLayout, { type LegalSection } from '@/components/marketing/LegalLayout';

const SECTIONS: LegalSection[] = [
    {
        title: 'Acceptance of Terms',
        body: (
            <p>By accessing or using TrialShield (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. TrialShield is operated by TrialShield (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;).</p>
        ),
    },
    {
        title: 'Description of Service',
        body: (
            <p>TrialShield provides a real-time API for detecting trial abuse and fraudulent signups. The Service analyzes signals such as email reputation, IP address intelligence, device fingerprinting, behavioral patterns, and payment card data to produce risk scores and recommendations.</p>
        ),
    },
    {
        title: 'Account Registration',
        body: (
            <p>To use the Service, you must create an account and provide accurate information. You are responsible for maintaining the confidentiality of your account credentials and API keys. You must notify us immediately of any unauthorized use of your account.</p>
        ),
    },
    {
        title: 'API Keys and Usage',
        body: (
            <p>API keys are issued per account and must not be shared publicly or with unauthorized third parties. You are responsible for all API calls made with your keys. We reserve the right to revoke API keys that are used in violation of these terms or that pose a security risk.</p>
        ),
    },
    {
        title: 'Subscriptions and Payment',
        body: (
            <p>Paid plans are billed monthly through our payment processor, Creem. Subscriptions renew automatically unless canceled before the end of the billing period. Refunds are handled on a case-by-case basis. We reserve the right to change pricing with 30 days&apos; notice.</p>
        ),
    },
    {
        title: 'Acceptable Use',
        body: (
            <>
                <p>You agree not to:</p>
                <ul style={{ paddingLeft: 20, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <li>Use the Service for any unlawful purpose</li>
                    <li>Attempt to reverse-engineer, decompile, or exploit the Service</li>
                    <li>Use the Service to discriminate against individuals based on protected characteristics</li>
                    <li>Exceed your plan&apos;s rate limits through automated means designed to circumvent restrictions</li>
                    <li>Resell or redistribute the Service without written authorization</li>
                </ul>
            </>
        ),
    },
    {
        title: 'Data Processing',
        body: (
            <p>You acknowledge that the Service processes data you send via the API, including email addresses, IP addresses, device fingerprints, and payment card metadata. You are responsible for ensuring you have the legal basis to share this data with TrialShield. All personally identifiable information (PII) is hashed before storage. See our <a href="/privacy" style={{ color: 'var(--accent)' }}>Privacy Policy</a> for full details.</p>
        ),
    },
    {
        title: 'Service Availability',
        body: (
            <p>We target 99.99% uptime but do not guarantee uninterrupted service. We are not liable for any downtime, data loss, or damages resulting from service interruptions, whether planned or unplanned.</p>
        ),
    },
    {
        title: 'Limitation of Liability',
        body: (
            <p>The Service is provided &quot;as is&quot; without warranties of any kind. TrialShield is not liable for any indirect, incidental, or consequential damages arising from the use of the Service. Our total liability is limited to the amount you paid in the 12 months preceding the claim.</p>
        ),
    },
    {
        title: 'Termination',
        body: (
            <p>Either party may terminate at any time. We may suspend or terminate your account immediately if you violate these terms. Upon termination, your API keys will be deactivated and your access to the dashboard will be revoked. You may request deletion of your data per our Privacy Policy.</p>
        ),
    },
    {
        title: 'Changes to Terms',
        body: (
            <p>We may update these terms at any time. We will notify registered users of material changes via email. Continued use of the Service after changes constitutes acceptance of the updated terms.</p>
        ),
    },
    {
        title: 'Contact',
        body: (
            <p>For questions about these terms, contact us at <a href="mailto:tomascorzo1203@gmail.com" style={{ color: 'var(--accent)' }}>tomascorzo1203@gmail.com</a>.</p>
        ),
    },
];

export default function TermsPage() {
    return (
        <LegalLayout
            eyebrow="Legal"
            title="Terms of Service"
            lastUpdated="March 22, 2026"
            sections={SECTIONS}
        />
    );
}
