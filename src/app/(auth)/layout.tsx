// Auth layout is intentionally pass-through. Each auth page renders its own
// full-bleed split layout (form on the left, dark testimonial panel on the right).

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
