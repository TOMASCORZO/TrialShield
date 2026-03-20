export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Background Glow Effect */}
            <div style={{
                position: 'absolute',
                top: '-20%',
                left: '20%',
                width: '60%',
                height: '60%',
                background: 'radial-gradient(circle, rgba(16, 185, 129, 0.05) 0%, transparent 70%)',
                zIndex: 0
            }} />

            <div style={{ 
                width: '100%', 
                maxWidth: '420px', 
                position: 'relative', 
                zIndex: 1 
            }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <a href="/" style={{ textDecoration: 'none', fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        🛡️ <span className="gradient-text">TrialShield</span>
                    </a>
                </div>
                {children}
            </div>
        </div>
    );
}
