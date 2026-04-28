// The dark right-hand panel shared by /login and /register.
// Contains the value-prop checklist and a customer testimonial.

import { CheckIcon } from './Icon';

const BENEFITS: [string, string][] = [
    ['Stable device ID', 'Persistent across cookies, incognito, and VPN switches.'],
    ['Bot & headless detection', 'Catches Puppeteer, Playwright, Selenium, and custom automation.'],
    ['Account-linking graph', 'See every account a single device controls, in real time.'],
    ['Drop-in SDKs', 'TypeScript, Go, Python, Ruby, Rust, Java. p99 under 100ms.'],
];

export default function AuthSplitPanel() {
    return (
        <div style={{
            background: 'var(--ink)', color: '#fff',
            padding: 48, position: 'relative', overflow: 'hidden',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            minHeight: '100vh',
        }}>
            <div className="grid-bg" style={{ position: 'absolute', inset: 0, opacity: 0.04, pointerEvents: 'none' }} />

            <div style={{ position: 'relative' }}>
                <div className="t-eyebrow" style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>
                    // What you get
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 380 }}>
                    {BENEFITS.map(([t, d]) => (
                        <div key={t} style={{ display: 'flex', gap: 14 }}>
                            <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 4 }}>
                                <CheckIcon />
                            </span>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{t}</div>
                                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                                    {d}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ position: 'relative', marginTop: 48 }}>
                <p style={{ fontSize: 16, lineHeight: 1.5, color: 'rgba(255,255,255,0.85)', marginBottom: 16, maxWidth: 420 }}>
                    &ldquo;Three lines of code and 94% of our trial abuse vanished. The other 6% surfaces in the dashboard so we can build rules.&rdquo;
                </p>
                <div className="t-body-sm" style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    Anonymous customer · SaaS, beta program
                </div>
            </div>
        </div>
    );
}
