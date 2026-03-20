'use client';

import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
    const router = useRouter();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    return (
        <button 
            onClick={handleLogout}
            style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-deny)',
                padding: '10px 16px',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                borderRadius: 'var(--radius-sm)',
                transition: 'all 0.2s ease',
                textAlign: 'left'
            }}
            onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-deny-bg)';
            }}
            onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
            }}
        >
            <span>🚪</span> Sign Out
        </button>
    );
}
