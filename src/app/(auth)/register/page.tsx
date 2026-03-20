'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
            });

            if (signUpError) throw signUpError;

            // Wait 1 second before redirecting or show success message
            // Depending on Supabase settings, email confirmation might be required.
            alert("Registration successful! You can now log in.");
            router.push('/login');
        } catch (err: any) {
            setError(err.message || 'An error occurred during registration.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-card animate-fade-in" style={{ padding: '40px' }}>
            <h1 style={{ fontSize: '24px', marginBottom: '8px', textAlign: 'center' }}>Create Account</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', marginBottom: '32px' }}>
                Join TrialShield to protect your revenue
            </p>

            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {error && (
                    <div className="badge badge-deny" style={{ padding: '12px', width: '100%', justifyContent: 'center', borderRadius: '8px' }}>
                        {error}
                    </div>
                )}

                <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
                        EMAIL ADDRESS
                    </label>
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                    />
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
                        PASSWORD
                    </label>
                    <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        minLength={6}
                    />
                </div>

                <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={loading}
                    style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
                >
                    {loading ? 'Creating account...' : 'Create Account'}
                </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                Already have an account?{' '}
                <a href="/login" style={{ color: 'var(--color-allow)', textDecoration: 'none', fontWeight: 600 }}>
                    Sign in
                </a>
            </div>
        </div>
    );
}
