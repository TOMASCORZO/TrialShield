'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';

type Step = 'loading' | 'welcome' | 'selfie' | 'document' | 'review' | 'submitting' | 'complete' | 'error';

interface SessionInfo {
    sessionId: string;
    status: string;
    redirectUrl?: string;
    expiresAt?: string;
}

export default function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
    const [sessionId, setSessionId] = useState<string>('');
    const [step, setStep] = useState<Step>('loading');
    const [session, setSession] = useState<SessionInfo | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [selfieData, setSelfieData] = useState<string | null>(null);
    const [documentData, setDocumentData] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [verified, setVerified] = useState(false);
    const [riskScore, setRiskScore] = useState(0);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Resolve params
    useEffect(() => {
        params.then(p => setSessionId(p.id));
    }, [params]);

    // Detect mobile
    useEffect(() => {
        setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    }, []);

    // Load session
    useEffect(() => {
        if (!sessionId) return;
        fetch(`/api/v1/kyc/session/${sessionId}`)
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    setErrorMsg(data.error || data.message || 'Session not found');
                    setStep('error');
                } else if (data.status === 'completed') {
                    setSession(data);
                    setVerified(data.result?.verified || false);
                    setStep('complete');
                } else if (data.status === 'expired') {
                    setErrorMsg('This verification session has expired. Please request a new one.');
                    setStep('error');
                } else {
                    setSession(data);
                    setStep('welcome');
                }
            })
            .catch(() => {
                setErrorMsg('Failed to load verification session.');
                setStep('error');
            });
    }, [sessionId]);

    // Poll for status (desktop waiting for mobile to complete)
    useEffect(() => {
        if (step !== 'welcome' || isMobile || !sessionId) return;
        const interval = setInterval(() => {
            fetch(`/api/v1/kyc/session/${sessionId}`)
                .then(r => r.json())
                .then(data => {
                    if (data.status === 'completed') {
                        setSession(data);
                        setVerified(data.result?.verified || false);
                        setStep('complete');
                    }
                })
                .catch(() => {});
        }, 3000);
        return () => clearInterval(interval);
    }, [step, isMobile, sessionId]);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setCameraActive(false);
    }, []);

    const startCamera = useCallback(async (facingMode: 'user' | 'environment') => {
        stopCamera();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setCameraActive(true);
        } catch {
            setErrorMsg('Camera access denied. Please allow camera access and try again.');
        }
    }, [stopCamera]);

    const capturePhoto = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) return null;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(video, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.85);
    }, []);

    const handleCaptureSelfie = useCallback(() => {
        const data = capturePhoto();
        if (data) {
            setSelfieData(data);
            stopCamera();
            setStep('document');
        }
    }, [capturePhoto, stopCamera]);

    const handleCaptureDocument = useCallback(() => {
        const data = capturePhoto();
        if (data) {
            setDocumentData(data);
            stopCamera();
            setStep('review');
        }
    }, [capturePhoto, stopCamera]);

    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'selfie' | 'document') => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            if (type === 'selfie') {
                setSelfieData(result);
                setStep('document');
            } else {
                setDocumentData(result);
                setStep('review');
            }
        };
        reader.readAsDataURL(file);
    }, []);

    const handleSubmit = useCallback(async () => {
        if (!selfieData || !documentData || !sessionId) return;
        setStep('submitting');

        try {
            const res = await fetch(`/api/v1/kyc/submit/${sessionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selfie: selfieData,
                    documentFront: documentData,
                    deviceInfo: {
                        userAgent: navigator.userAgent,
                        language: navigator.language,
                        screen: `${screen.width}x${screen.height}`,
                        platform: navigator.platform,
                        timestamp: new Date().toISOString(),
                    },
                }),
            });

            const data = await res.json();
            if (res.ok) {
                setVerified(data.verified);
                setRiskScore(data.riskScore || 0);
                setStep('complete');

                // Redirect after delay if redirect URL exists
                if (session?.redirectUrl) {
                    setTimeout(() => {
                        const url = new URL(session.redirectUrl!);
                        url.searchParams.set('session_id', sessionId);
                        url.searchParams.set('status', 'completed');
                        url.searchParams.set('verified', String(data.verified));
                        window.location.href = url.toString();
                    }, 3000);
                }
            } else {
                setErrorMsg(data.error || 'Verification failed');
                setStep('error');
            }
        } catch {
            setErrorMsg('Network error. Please try again.');
            setStep('error');
        }
    }, [selfieData, documentData, sessionId, session]);

    // Start camera when entering selfie/document steps
    useEffect(() => {
        if (step === 'selfie') startCamera('user');
        if (step === 'document') startCamera('environment');
        return () => { if (step === 'selfie' || step === 'document') stopCamera(); };
    }, [step, startCamera, stopCamera]);

    const verifyUrl = typeof window !== 'undefined' ? window.location.href : '';

    // ─── Styles ─────────────────────────────────────────────────
    const containerStyle: React.CSSProperties = {
        minHeight: '100vh',
        background: '#0a0a0f',
        color: '#e4e4e7',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '24px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    };

    const cardStyle: React.CSSProperties = {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '480px',
        width: '100%',
        textAlign: 'center',
    };

    const btnPrimary: React.CSSProperties = {
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        color: 'white', border: 'none', borderRadius: '10px',
        padding: '14px 28px', fontSize: '15px', fontWeight: 700,
        cursor: 'pointer', width: '100%', marginTop: '16px',
    };

    const btnSecondary: React.CSSProperties = {
        background: 'rgba(255,255,255,0.06)',
        color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '10px', padding: '12px 24px', fontSize: '14px',
        fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: '12px',
    };

    const progressDots = (current: number) => (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}>
            {['Selfie', 'Document', 'Review'].map((label, i) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: i < current ? '#10b981' : i === current ? '#6366f1' : 'rgba(255,255,255,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', fontWeight: 700, color: 'white',
                        transition: 'all 0.3s',
                    }}>
                        {i < current ? '✓' : i + 1}
                    </div>
                    <span style={{ fontSize: '12px', color: i <= current ? '#e4e4e7' : '#52525b' }}>{label}</span>
                    {i < 2 && <div style={{ width: '20px', height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />}
                </div>
            ))}
        </div>
    );

    // ─── Render steps ───────────────────────────────────────────
    return (
        <div style={containerStyle}>
            {/* Header */}
            <div style={{ marginBottom: '32px', marginTop: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                    🛡️ <span style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TrialShield</span>
                </div>
                <div style={{ fontSize: '13px', color: '#71717a', marginTop: '4px' }}>Identity Verification</div>
            </div>

            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Loading */}
            {step === 'loading' && (
                <div style={cardStyle}>
                    <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏳</div>
                    <p style={{ color: '#a1a1aa' }}>Loading verification session...</p>
                </div>
            )}

            {/* Error */}
            {step === 'error' && (
                <div style={cardStyle}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>Verification Error</h2>
                    <p style={{ color: '#a1a1aa', lineHeight: '1.6' }}>{errorMsg}</p>
                </div>
            )}

            {/* Welcome */}
            {step === 'welcome' && (
                <div style={cardStyle}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🪪</div>
                    <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px' }}>Verify Your Identity</h2>
                    <p style={{ color: '#a1a1aa', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
                        To continue, we need to verify your identity. This takes about 60 seconds.
                    </p>

                    <div style={{
                        background: 'rgba(99,102,241,0.08)', borderRadius: '12px',
                        padding: '16px', marginBottom: '24px', textAlign: 'left',
                    }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>What you&apos;ll need:</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#a1a1aa' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '16px' }}>📸</span> A clear selfie of your face
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '16px' }}>🪪</span> A photo of your ID document (front)
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '16px' }}>💡</span> Good lighting and a steady hand
                            </div>
                        </div>
                    </div>

                    <button style={btnPrimary} onClick={() => setStep('selfie')}>
                        Start Verification
                    </button>

                    {/* QR Code for desktop users */}
                    {!isMobile && (
                        <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <p style={{ fontSize: '13px', color: '#71717a', marginBottom: '16px' }}>
                                Or scan this QR code to verify on your phone
                            </p>
                            <div style={{
                                display: 'inline-block', padding: '12px',
                                background: 'white', borderRadius: '12px',
                            }}>
                                <QRCodeSVG value={verifyUrl} size={160} level="M" />
                            </div>
                            <p style={{ fontSize: '11px', color: '#52525b', marginTop: '12px' }}>
                                The page will update automatically once you complete verification on your phone.
                            </p>
                        </div>
                    )}

                    <p style={{ fontSize: '11px', color: '#3f3f46', marginTop: '20px', lineHeight: '1.5' }}>
                        Your data is encrypted and processed securely by TrialShield.
                        <br />All images are hashed — raw photos are not stored permanently.
                    </p>
                </div>
            )}

            {/* Selfie Capture */}
            {step === 'selfie' && (
                <div style={{ ...cardStyle, padding: '24px' }}>
                    {progressDots(0)}
                    <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Take a Selfie</h2>
                    <p style={{ fontSize: '13px', color: '#71717a', marginBottom: '16px' }}>
                        Position your face in the center and look at the camera.
                    </p>

                    {cameraActive ? (
                        <>
                            <div style={{
                                position: 'relative', borderRadius: '12px', overflow: 'hidden',
                                border: '2px solid rgba(99,102,241,0.3)', marginBottom: '16px',
                            }}>
                                <video ref={videoRef} autoPlay playsInline muted
                                    style={{ width: '100%', display: 'block', transform: 'scaleX(-1)' }} />
                                <div style={{
                                    position: 'absolute', top: '50%', left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: '180px', height: '220px',
                                    border: '2px dashed rgba(99,102,241,0.5)',
                                    borderRadius: '50%',
                                }} />
                            </div>
                            <button style={btnPrimary} onClick={handleCaptureSelfie}>
                                📸 Capture Selfie
                            </button>
                        </>
                    ) : (
                        <div style={{ color: '#71717a', padding: '40px 0' }}>
                            <p>Starting camera...</p>
                        </div>
                    )}

                    <label style={btnSecondary as React.CSSProperties}>
                        📁 Upload from files instead
                        <input type="file" accept="image/*" capture="user" style={{ display: 'none' }}
                            onChange={(e) => handleFileUpload(e, 'selfie')} />
                    </label>
                </div>
            )}

            {/* Document Capture */}
            {step === 'document' && (
                <div style={{ ...cardStyle, padding: '24px' }}>
                    {progressDots(1)}
                    <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Scan Your ID</h2>
                    <p style={{ fontSize: '13px', color: '#71717a', marginBottom: '16px' }}>
                        Place the front of your ID document within the frame.
                    </p>

                    {selfieData && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'rgba(16,185,129,0.08)', borderRadius: '8px',
                            padding: '8px 12px', marginBottom: '16px', fontSize: '13px',
                        }}>
                            <span>✅</span> Selfie captured
                        </div>
                    )}

                    {cameraActive ? (
                        <>
                            <div style={{
                                position: 'relative', borderRadius: '12px', overflow: 'hidden',
                                border: '2px solid rgba(99,102,241,0.3)', marginBottom: '16px',
                            }}>
                                <video ref={videoRef} autoPlay playsInline muted
                                    style={{ width: '100%', display: 'block' }} />
                                <div style={{
                                    position: 'absolute', top: '50%', left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: '85%', height: '60%',
                                    border: '2px dashed rgba(99,102,241,0.5)',
                                    borderRadius: '12px',
                                }} />
                            </div>
                            <button style={btnPrimary} onClick={handleCaptureDocument}>
                                🪪 Capture Document
                            </button>
                        </>
                    ) : (
                        <div style={{ color: '#71717a', padding: '40px 0' }}>
                            <p>Starting camera...</p>
                        </div>
                    )}

                    <label style={btnSecondary as React.CSSProperties}>
                        📁 Upload from files instead
                        <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                            onChange={(e) => handleFileUpload(e, 'document')} />
                    </label>
                </div>
            )}

            {/* Review */}
            {step === 'review' && (
                <div style={{ ...cardStyle, padding: '24px' }}>
                    {progressDots(2)}
                    <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Review & Submit</h2>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                        <div>
                            <div style={{ fontSize: '12px', color: '#71717a', marginBottom: '6px', fontWeight: 600 }}>SELFIE</div>
                            <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={selfieData!} alt="Selfie" style={{ width: '100%', display: 'block', transform: 'scaleX(-1)' }} />
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '12px', color: '#71717a', marginBottom: '6px', fontWeight: 600 }}>ID DOCUMENT</div>
                            <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={documentData!} alt="Document" style={{ width: '100%', display: 'block' }} />
                            </div>
                        </div>
                    </div>

                    <div style={{
                        display: 'flex', gap: '8px',
                        background: 'rgba(245,158,11,0.08)', borderRadius: '8px',
                        padding: '10px 14px', marginBottom: '16px', fontSize: '12px',
                        color: '#fbbf24', textAlign: 'left',
                    }}>
                        ⚠️ Make sure both photos are clear and well-lit before submitting.
                    </div>

                    <button style={btnPrimary} onClick={handleSubmit}>
                        ✅ Submit Verification
                    </button>

                    <button style={btnSecondary} onClick={() => {
                        setSelfieData(null);
                        setDocumentData(null);
                        setStep('selfie');
                    }}>
                        🔄 Retake Photos
                    </button>
                </div>
            )}

            {/* Submitting */}
            {step === 'submitting' && (
                <div style={cardStyle}>
                    <div style={{ fontSize: '48px', marginBottom: '16px', animation: 'spin 1s linear infinite' }}>⏳</div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Processing...</h2>
                    <p style={{ color: '#a1a1aa', fontSize: '14px' }}>Analyzing your verification data. This may take a moment.</p>
                    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                </div>
            )}

            {/* Complete */}
            {step === 'complete' && (
                <div style={cardStyle}>
                    <div style={{ fontSize: '56px', marginBottom: '16px' }}>{verified ? '✅' : '⚠️'}</div>
                    <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px' }}>
                        {verified ? 'Verification Complete' : 'Verification Review Required'}
                    </h2>
                    <p style={{ color: '#a1a1aa', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
                        {verified
                            ? 'Your identity has been verified successfully. You can close this page.'
                            : 'Your submission is under review. The service provider will contact you if additional information is needed.'}
                    </p>

                    {session?.redirectUrl && (
                        <p style={{ fontSize: '13px', color: '#6366f1' }}>
                            Redirecting you back...
                        </p>
                    )}

                    <div style={{
                        marginTop: '16px', padding: '12px',
                        background: 'rgba(255,255,255,0.03)', borderRadius: '10px',
                        fontSize: '12px', color: '#52525b',
                    }}>
                        Session: {sessionId?.slice(0, 8)}... · Powered by TrialShield
                    </div>
                </div>
            )}
        </div>
    );
}
