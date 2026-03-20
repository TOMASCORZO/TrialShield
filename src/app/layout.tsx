import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'TrialShield — Free Trial Abuse Detection API',
    description: 'Real-time abuse detection for free trials. Stop account farming with 100+ risk signals, device fingerprinting, and ML-powered scoring.',
    keywords: ['trial abuse', 'fraud detection', 'device fingerprinting', 'risk scoring', 'account farming'],
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
