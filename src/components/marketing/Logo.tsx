// Geometric monogram — rotated square with inner mark, not a literal shield.
// Mirrors the design bundle's Logo component.

interface LogoProps {
    size?: number;
    color?: string;
    showText?: boolean;
}

export default function Logo({ size = 20, color, showText = true }: LogoProps) {
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="TrialShield">
                <rect x="2" y="2" width="20" height="20" rx="5" fill={color || 'var(--ink)'} />
                <path d="M7 9.5 L12 7 L17 9.5 L17 14 L12 17 L7 14 Z" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="1.6" fill="#fff" />
            </svg>
            {showText && (
                <span style={{
                    fontSize: 15, fontWeight: 500, letterSpacing: '-0.015em',
                    color: color || 'var(--ink)',
                }}>
                    TrialShield
                </span>
            )}
        </span>
    );
}
