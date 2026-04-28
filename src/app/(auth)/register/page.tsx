'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Logo from '@/components/marketing/Logo';
import AuthSplitPanel from '@/components/marketing/AuthSplitPanel';
import { ArrowIcon } from '@/components/marketing/Icon';

export default function RegisterPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [workspace, setWorkspace] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                router.replace('/dashboard');
            } else {
                setChecking(false);
            }
        });
    }, [router]);

    async function handleRegister(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setInfo(null);

        try {
            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: workspace ? { data: { workspace } } : undefined,
            });
            if (signUpError) throw signUpError;
            if (data.session) {
                router.push('/dashboard');
                return;
            }
            setInfo('Check your email to confirm your account, then sign in.');
            setTimeout(() => router.push('/login'), 3000);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'An error occurred during registration.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    }

    if (checking) return null;

    return (
        <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--bg)' }}>
            <div style={{ padding: '32px 48px', display: 'flex', flexDirection: 'column' }}>
                <a href="/" style={{ textDecoration: 'none' }}>
                    <Logo />
                </a>

                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '100%', maxWidth: 380 }}>
                        <h1 className="t-h2" style={{ margin: '0 0 8px' }}>Create your workspace</h1>
                        <p className="t-body" style={{ marginTop: 0, marginBottom: 32 }}>
                            Free trial available on request — no credit card to get started.
                        </p>

                        {error && (
                            <div style={{
                                padding: '10px 14px', marginBottom: 16,
                                background: 'var(--red-soft)',
                                border: '1px solid var(--red-line)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--red)', fontSize: 13,
                            }}>
                                {error}
                            </div>
                        )}
                        {info && (
                            <div style={{
                                padding: '10px 14px', marginBottom: 16,
                                background: 'var(--accent-soft)',
                                border: '1px solid var(--accent-line)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--accent-deep)', fontSize: 13,
                            }}>
                                {info}
                            </div>
                        )}

                        <form onSubmit={handleRegister}>
                            <div style={{ marginBottom: 12 }}>
                                <div className="t-body-sm" style={{ fontSize: 12, marginBottom: 6, color: 'var(--ink-2)' }}>Work email</div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="you@company.com"
                                />
                            </div>
                            <div style={{ marginBottom: 12 }}>
                                <div className="t-body-sm" style={{ fontSize: 12, marginBottom: 6, color: 'var(--ink-2)' }}>Password</div>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="At least 6 characters"
                                />
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <div className="t-body-sm" style={{ fontSize: 12, marginBottom: 6, color: 'var(--ink-2)' }}>Workspace name <span style={{ color: 'var(--ink-4)' }}>(optional)</span></div>
                                <input
                                    type="text"
                                    value={workspace}
                                    onChange={e => setWorkspace(e.target.value)}
                                    placeholder="Acme Inc."
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="btn btn-accent"
                                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                            >
                                {loading ? 'Creating workspace...' : <>Create workspace <ArrowIcon /></>}
                            </button>
                        </form>

                        <p className="t-body-sm" style={{ marginTop: 24, textAlign: 'center', fontSize: 12 }}>
                            Already have an account?{' '}
                            <a href="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                                Sign in
                            </a>
                        </p>
                    </div>
                </div>

                <div className="t-body-sm" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                    © {new Date().getFullYear()} TrialShield · <span style={{ color: 'var(--ink-4)' }}>SOC 2 · GDPR · ISO 27001</span>
                </div>
            </div>

            <AuthSplitPanel />
        </div>
    );
}
