// Tiny inline SVG icons used across the marketing surfaces.

export const ArrowIcon = ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
        <path d="M3 7h8m0 0L8 4m3 3l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export const CheckIcon = ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
        <path d="M3 7.5L6 10l5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export const XIcon = ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
        <path d="M4 4l6 6m0-6l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

export const CopyIcon = ({ size = 13 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
        <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M10 4V3a1 1 0 00-1-1H3a1 1 0 00-1 1v6a1 1 0 001 1h1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
);

export const ExternalIcon = ({ size = 11 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
        <path d="M5 3H3v6h6V7M7 3h2v2M5 7l4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
);

export const SearchIcon = ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
        <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4" />
        <path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
);

export const InfoIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 4v5M8 11v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
);
