'use client';

// Conditionally show a link to the admin panel for users in ADMIN_EMAILS.
// Hidden by default — looks like the rest of the sidebar nav when shown.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminLink() {
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function check() {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            try {
                const res = await fetch('/api/v1/billing/status', {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled && data.isAdmin) setIsAdmin(true);
            } catch { /* swallow */ }
        }
        check();
        return () => { cancelled = true; };
    }, []);

    if (!isAdmin) return null;

    return (
        <a href="/admin/trials" id="nav-admin" style={{ color: '#ec4899' }}>
            <span>🛡️</span> Admin
        </a>
    );
}
