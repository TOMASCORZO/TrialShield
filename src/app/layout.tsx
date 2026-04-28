import type { Metadata } from 'next';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://trialshield.cc';

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: 'TrialShield — Free Trial Abuse Detection API',
        template: '%s · TrialShield',
    },
    description: 'Real-time abuse detection for free trials. Stop account farming with 100+ risk signals, device fingerprinting, and ML-powered scoring.',
    keywords: ['trial abuse', 'fraud detection', 'device fingerprinting', 'risk scoring', 'account farming'],
    authors: [{ name: 'TrialShield' }],
    openGraph: {
        type: 'website',
        url: SITE_URL,
        siteName: 'TrialShield',
        title: 'TrialShield — Stop Trial Abuse Before It Starts',
        description: 'Real-time risk scoring with 100+ signals. Detect disposable emails, VPN/TOR users, device farms, and coordinated attacks — all in under 100ms.',
        locale: 'en_US',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'TrialShield — Stop Trial Abuse Before It Starts',
        description: 'Real-time risk scoring API. 100+ signals, sub-100ms latency.',
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
    icons: {
        icon: [
            { url: '/icon.svg', type: 'image/svg+xml' },
        ],
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>
                {children}
            </body>
        </html>
    );
}
