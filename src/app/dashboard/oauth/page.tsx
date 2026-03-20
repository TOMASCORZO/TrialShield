'use client';

import { useState, useEffect } from 'react';

interface OAuthConfig {
    provider: string;
    client_id: string;
    redirect_uri: string;
    scopes: string[];
    is_active: boolean;
    updated_at: string;
}

interface ProviderCard {
    id: 'google' | 'github';
    name: string;
    icon: string;
    color: string;
    bgColor: string;
    description: string;
    docsUrl: string;
    defaultScopes: string[];
    scopeDescriptions: Record<string, string>;
    setupSteps: string[];
}

const PROVIDERS: ProviderCard[] = [
    {
        id: 'google',
        name: 'Google',
        icon: '🔵',
        color: '#4285F4',
        bgColor: 'rgba(66, 133, 244, 0.08)',
        description: 'Allow users to sign up with their Google account. TrialShield automatically detects account creation date via Google Drive API.',
        docsUrl: 'https://console.cloud.google.com/apis/credentials',
        defaultScopes: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive.metadata.readonly'],
        scopeDescriptions: {
            'openid': 'Basic identity verification',
            'email': 'User\'s email address',
            'profile': 'Name, avatar, locale',
            'https://www.googleapis.com/auth/drive.metadata.readonly': 'Account creation date (Drive root folder)',
        },
        setupSteps: [
            'Go to Google Cloud Console → APIs & Services → Credentials',
            'Create OAuth 2.0 Client ID (Web application)',
            'Add the Authorized Redirect URI shown below',
            'Copy the Client ID and Client Secret here',
        ],
    },
    {
        id: 'github',
        name: 'GitHub',
        icon: '⚫',
        color: '#24292e',
        bgColor: 'rgba(36, 41, 46, 0.08)',
        description: 'Allow users to sign up with their GitHub account. TrialShield automatically extracts account age, repos, followers, and flags throwaway accounts.',
        docsUrl: 'https://github.com/settings/developers',
        defaultScopes: ['read:user', 'user:email'],
        scopeDescriptions: {
            'read:user': 'Profile, account creation date, repos, followers',
            'user:email': 'Email address and verification status',
        },
        setupSteps: [
            'Go to GitHub → Settings → Developer Settings → OAuth Apps',
            'Create a new OAuth App',
            'Set the Authorization Callback URL to the URI shown below',
            'Copy the Client ID and Client Secret here',
        ],
    },
];

export default function OAuthPage() {
    const [configs, setConfigs] = useState<Record<string, OAuthConfig>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState('');

    // Form state per provider
    const [forms, setForms] = useState<Record<string, {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
    }>>({
        google: { clientId: '', clientSecret: '', redirectUri: '' },
        github: { clientId: '', clientSecret: '', redirectUri: '' },
    });

    const apiKey = typeof window !== 'undefined'
        ? (process.env.NEXT_PUBLIC_TRIALSHIELD_TEST_KEY || 'master')
        : 'master';

    const callbackUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/api/v1/oauth/callback`
        : '';

    useEffect(() => { fetchConfigs(); }, []);

    async function fetchConfigs() {
        try {
            const res = await fetch('/api/v1/oauth/config', {
                headers: { 'X-API-Key': apiKey },
            });
            const data = await res.json();
            const map: Record<string, OAuthConfig> = {};
            for (const c of (data.configs || [])) {
                map[c.provider] = c;
            }
            setConfigs(map);

            // Pre-fill forms
            for (const [provider, config] of Object.entries(map)) {
                setForms(prev => ({
                    ...prev,
                    [provider]: {
                        clientId: config.client_id || '',
                        clientSecret: '', // Never pre-fill secrets
                        redirectUri: config.redirect_uri || '',
                    },
                }));
            }
        } catch { }
        finally { setLoading(false); }
    }

    async function saveProvider(providerId: string) {
        const form = forms[providerId];
        if (!form.clientId || !form.clientSecret) return;

        setSaving(providerId);
        try {
            const res = await fetch('/api/v1/oauth/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey,
                },
                body: JSON.stringify({
                    provider: providerId,
                    clientId: form.clientId,
                    clientSecret: form.clientSecret,
                    redirectUri: form.redirectUri || callbackUrl,
                }),
            });

            if (res.ok) {
                setSuccessMessage(`${providerId === 'google' ? 'Google' : 'GitHub'} OAuth configured successfully!`);
                setTimeout(() => setSuccessMessage(''), 4000);
                fetchConfigs();
            }
        } catch { }
        finally { setSaving(null); }
    }

    async function toggleProvider(providerId: string, enabled: boolean) {
        // If enabling and no config exists, expand the card
        if (enabled && !configs[providerId]) {
            setExpandedProvider(providerId);
            return;
        }
        // TODO: implement disable via API
    }

    function updateForm(provider: string, field: string, value: string) {
        setForms(prev => ({
            ...prev,
            [provider]: { ...prev[provider], [field]: value },
        }));
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                <div className="loading-spinner" style={{ width: '40px', height: '40px' }}></div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1>🔐 Auth Providers</h1>
                    <p>Configure OAuth providers for automatic account age detection</p>
                </div>
            </div>

            {/* Success banner */}
            {successMessage && (
                <div style={{
                    padding: '14px 20px',
                    marginBottom: '24px',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: '12px',
                    color: 'var(--color-allow)',
                    fontSize: '14px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    animation: 'fadeIn 0.3s ease',
                }}>
                    ✅ {successMessage}
                </div>
            )}

            {/* How it works banner */}
            <div className="glass-card" style={{
                padding: '20px 24px',
                marginBottom: '24px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.06), rgba(168, 85, 247, 0.06))',
                border: '1px solid rgba(99, 102, 241, 0.15)',
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    <span style={{ fontSize: '28px' }}>⚡</span>
                    <div>
                        <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>
                            How TrialShield OAuth Works
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                            <strong>1.</strong> Enable a provider and enter your OAuth credentials below<br />
                            <strong>2.</strong> Redirect your users to the <strong>Authorize URL</strong> (shown after setup)<br />
                            <strong>3.</strong> TrialShield handles the entire OAuth flow — consent, token exchange, metadata fetch<br />
                            <strong>4.</strong> Users are redirected back to your app with <strong>profile data + risk score</strong> in query params
                        </div>
                    </div>
                </div>
            </div>

            {/* Provider cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {PROVIDERS.map(provider => {
                    const config = configs[provider.id];
                    const isEnabled = !!config?.is_active;
                    const isExpanded = expandedProvider === provider.id;
                    const form = forms[provider.id];
                    const isSaving = saving === provider.id;

                    return (
                        <div key={provider.id} className="glass-card" style={{
                            padding: 0,
                            overflow: 'hidden',
                            border: isEnabled
                                ? `1px solid ${provider.color}40`
                                : '1px solid var(--border-subtle)',
                            transition: 'all 0.3s ease',
                        }}>
                            {/* Provider header row */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '20px 24px',
                                cursor: 'pointer',
                                transition: 'background 0.2s',
                            }}
                                onClick={() => setExpandedProvider(isExpanded ? null : provider.id)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    {/* Provider icon */}
                                    <div style={{
                                        width: '48px', height: '48px',
                                        borderRadius: '12px',
                                        background: provider.bgColor,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '24px',
                                        border: `1px solid ${provider.color}20`,
                                    }}>
                                        {provider.id === 'google' ? (
                                            <svg width="24" height="24" viewBox="0 0 24 24">
                                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                            </svg>
                                        ) : (
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                            </svg>
                                        )}
                                    </div>

                                    <div>
                                        <div style={{ fontSize: '16px', fontWeight: 700 }}>
                                            {provider.name}
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                            {isEnabled ? 'Enabled — detecting account age' : 'Not configured'}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    {/* Status badge */}
                                    {isEnabled && (
                                        <span className="badge badge-allow" style={{ fontSize: '12px' }}>
                                            Active
                                        </span>
                                    )}

                                    {/* Toggle switch */}
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!isEnabled) {
                                                setExpandedProvider(provider.id);
                                            }
                                        }}
                                        style={{
                                            width: '44px', height: '24px',
                                            borderRadius: '12px',
                                            background: isEnabled ? 'var(--color-allow)' : 'var(--bg-tertiary)',
                                            position: 'relative',
                                            cursor: 'pointer',
                                            transition: 'background 0.3s ease',
                                        }}
                                    >
                                        <div style={{
                                            width: '18px', height: '18px',
                                            borderRadius: '50%',
                                            background: 'white',
                                            position: 'absolute',
                                            top: '3px',
                                            left: isEnabled ? '23px' : '3px',
                                            transition: 'left 0.3s ease',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                        }} />
                                    </div>

                                    {/* Expand chevron */}
                                    <span style={{
                                        fontSize: '14px',
                                        color: 'var(--text-muted)',
                                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.3s ease',
                                    }}>
                                        ▼
                                    </span>
                                </div>
                            </div>

                            {/* Expanded configuration panel */}
                            {isExpanded && (
                                <div style={{
                                    padding: '0 24px 24px',
                                    borderTop: '1px solid var(--border-subtle)',
                                    animation: 'fadeIn 0.3s ease',
                                }}>
                                    {/* Description */}
                                    <div style={{
                                        padding: '16px 0',
                                        fontSize: '13px',
                                        color: 'var(--text-secondary)',
                                        lineHeight: '1.6',
                                    }}>
                                        {provider.description}
                                    </div>

                                    {/* Setup steps */}
                                    <div style={{
                                        padding: '16px',
                                        background: 'var(--bg-secondary)',
                                        borderRadius: '10px',
                                        marginBottom: '20px',
                                        border: '1px solid var(--border-subtle)',
                                    }}>
                                        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            📝 Quick Setup
                                            <a href={provider.docsUrl} target="_blank" rel="noopener"
                                                style={{ fontSize: '12px', color: provider.color, fontWeight: 500, textDecoration: 'none' }}>
                                                Open {provider.name} Console ↗
                                            </a>
                                        </div>
                                        <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '2' }}>
                                            {provider.setupSteps.map((step, i) => (
                                                <li key={i}>{step}</li>
                                            ))}
                                        </ol>
                                    </div>

                                    {/* Callback URL (read-only) */}
                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                                            Callback URL <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(add this to your {provider.name} app)</span>
                                        </label>
                                        <div style={{
                                            display: 'flex', gap: '8px', alignItems: 'center',
                                        }}>
                                            <input
                                                type="text"
                                                value={callbackUrl}
                                                readOnly
                                                style={{
                                                    flex: 1,
                                                    background: 'var(--bg-tertiary)',
                                                    fontFamily: 'monospace',
                                                    fontSize: '13px',
                                                    cursor: 'text',
                                                }}
                                            />
                                            <button
                                                className="btn btn-sm"
                                                style={{
                                                    background: 'var(--bg-tertiary)',
                                                    border: '1px solid var(--border-subtle)',
                                                    fontSize: '12px',
                                                    padding: '8px 12px',
                                                    whiteSpace: 'nowrap',
                                                }}
                                                onClick={() => navigator.clipboard.writeText(callbackUrl)}
                                            >
                                                📋 Copy
                                            </button>
                                        </div>
                                    </div>

                                    {/* Form fields */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                        <div>
                                            <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                                                Client ID
                                            </label>
                                            <input
                                                type="text"
                                                placeholder={provider.id === 'google' ? 'xxxx.apps.googleusercontent.com' : 'Ov5_xxxxxxxxxxxx'}
                                                value={form.clientId}
                                                onChange={e => updateForm(provider.id, 'clientId', e.target.value)}
                                                style={{ width: '100%', fontFamily: 'monospace', fontSize: '13px' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                                                Client Secret
                                            </label>
                                            <input
                                                type="password"
                                                placeholder={config ? '••••••••••••••••' : 'Enter client secret'}
                                                value={form.clientSecret}
                                                onChange={e => updateForm(provider.id, 'clientSecret', e.target.value)}
                                                style={{ width: '100%', fontFamily: 'monospace', fontSize: '13px' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Redirect URI */}
                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                                            Your Redirect URI <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(where users land after auth)</span>
                                        </label>
                                        <input
                                            type="url"
                                            placeholder="https://yourapp.com/auth/callback"
                                            value={form.redirectUri}
                                            onChange={e => updateForm(provider.id, 'redirectUri', e.target.value)}
                                            style={{ width: '100%', fontSize: '13px' }}
                                        />
                                    </div>

                                    {/* Scopes */}
                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                                            Scopes <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(auto-configured)</span>
                                        </label>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {provider.defaultScopes.map(scope => (
                                                <div key={scope} style={{
                                                    padding: '6px 12px',
                                                    background: 'var(--bg-tertiary)',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    fontFamily: 'monospace',
                                                    border: '1px solid var(--border-subtle)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                }}>
                                                    <span style={{ color: 'var(--color-allow)' }}>✓</span>
                                                    {scope.replace('https://www.googleapis.com/auth/', '')}
                                                    <span style={{
                                                        fontSize: '11px',
                                                        color: 'var(--text-muted)',
                                                        borderLeft: '1px solid var(--border-subtle)',
                                                        paddingLeft: '6px',
                                                        marginLeft: '2px',
                                                    }}>
                                                        {provider.scopeDescriptions[scope]}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Save button */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                            {config?.updated_at
                                                ? `Last updated: ${new Date(config.updated_at).toLocaleString()}`
                                                : 'Not configured yet'
                                            }
                                        </div>
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => saveProvider(provider.id)}
                                            disabled={isSaving || !form.clientId || !form.clientSecret}
                                            style={{
                                                opacity: (!form.clientId || !form.clientSecret) ? 0.5 : 1,
                                                cursor: (!form.clientId || !form.clientSecret) ? 'not-allowed' : 'pointer',
                                                padding: '10px 20px',
                                            }}
                                        >
                                            {isSaving ? '⏳ Saving...' : isEnabled ? '💾 Update Configuration' : '✅ Enable Provider'}
                                        </button>
                                    </div>

                                    {/* If already configured, show authorize URL */}
                                    {isEnabled && (
                                        <div style={{
                                            marginTop: '20px',
                                            padding: '16px',
                                            background: 'rgba(16, 185, 129, 0.05)',
                                            borderRadius: '10px',
                                            border: '1px solid rgba(16, 185, 129, 0.15)',
                                        }}>
                                            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: 'var(--color-allow)' }}>
                                                🔗 Authorize URL — Redirect your users here
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <input
                                                    type="text"
                                                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/oauth/authorize?provider=${provider.id}&api_key=${apiKey}`}
                                                    readOnly
                                                    style={{
                                                        flex: 1,
                                                        background: 'var(--bg-primary)',
                                                        fontFamily: 'monospace',
                                                        fontSize: '12px',
                                                    }}
                                                />
                                                <button
                                                    className="btn btn-sm"
                                                    style={{
                                                        background: 'var(--bg-tertiary)',
                                                        border: '1px solid var(--border-subtle)',
                                                        fontSize: '12px',
                                                        padding: '8px 12px',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                    onClick={() => navigator.clipboard.writeText(
                                                        `${window.location.origin}/api/v1/oauth/authorize?provider=${provider.id}&api_key=${apiKey}`
                                                    )}
                                                >
                                                    📋 Copy
                                                </button>
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.5' }}>
                                                Add this as your &quot;Sign up with {provider.name}&quot; button link. TrialShield handles everything else.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* What TrialShield detects */}
            <div className="glass-card" style={{ padding: '24px', marginTop: '24px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '20px' }}>🧠 What TrialShield Detects Automatically</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Google
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '2' }}>
                            <li>📅 Account creation date (via Drive root folder)</li>
                            <li>🖼️ Profile picture (default avatar detection)</li>
                            <li>✉️ Email verification status</li>
                            <li>👤 Display name completeness</li>
                            <li>🌍 Account locale</li>
                        </ul>
                    </div>
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                            </svg>
                            GitHub
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '2' }}>
                            <li>📅 Account creation date (via API)</li>
                            <li>📦 Public repositories count</li>
                            <li>👥 Followers &amp; following</li>
                            <li>📝 Gists count</li>
                            <li>🧑 Username, bio, avatar</li>
                            <li>🚨 Throwaway account detection (new + empty)</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
