'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';

type Step = 'loading' | 'welcome' | 'document' | 'processing_doc' | 'selfie' | 'liveness' | 'review' | 'submitting' | 'complete' | 'error';
type Level = 'document_only' | 'document_face' | 'full';

interface SessionInfo {
    sessionId: string;
    status: string;
    level: Level;
    redirectUrl?: string;
    expiresAt?: string;
    result?: Record<string, unknown>;
}

interface DocumentData {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    documentNumber?: string;
    expiryDate?: string;
    nationality?: string;
    gender?: string;
    documentType?: string;
    issuingCountry?: string;
}

interface MrzData {
    valid: boolean;
    format?: string;
    documentNumber?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    expiryDate?: string;
    nationality?: string;
    sex?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let faceapi: any = null;

export default function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
    const [sessionId, setSessionId] = useState('');
    const [step, setStep] = useState<Step>('loading');
    const [session, setSession] = useState<SessionInfo | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [isMobile, setIsMobile] = useState(false);

    // Captures
    const [documentImage, setDocumentImage] = useState<string | null>(null);
    const [selfieImage, setSelfieImage] = useState<string | null>(null);

    // Analysis results
    const [ocrText, setOcrText] = useState('');
    const [documentData, setDocumentData] = useState<DocumentData | null>(null);
    const [mrzData, setMrzData] = useState<MrzData | null>(null);
    const [faceMatchScore, setFaceMatchScore] = useState<number | null>(null);
    const [faceOnDoc, setFaceOnDoc] = useState(false);
    const [faceOnSelfie, setFaceOnSelfie] = useState(false);
    const [livenessPass, setLivenessPass] = useState(false);
    const [blinkDetected, setBlinkDetected] = useState(false);
    const [processingStatus, setProcessingStatus] = useState('');
    const [verified, setVerified] = useState(false);
    const [decision, setDecision] = useState('');
    const [riskScore, setRiskScore] = useState(0);

    // Camera
    const [cameraActive, setCameraActive] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Liveness
    const [livenessMsg, setLivenessMsg] = useState('');
    const [blinkCount, setBlinkCount] = useState(0);
    const livenessRunning = useRef(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docDescriptorRef = useRef<any>(null);

    // face-api models loaded
    const [modelsLoaded, setModelsLoaded] = useState(false);

    useEffect(() => { params.then(p => setSessionId(p.id)); }, [params]);
    useEffect(() => { setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)); }, []);

    // Load session
    useEffect(() => {
        if (!sessionId) return;
        fetch(`/api/v1/kyc/session/${sessionId}`)
            .then(r => r.json())
            .then(data => {
                if (data.error) { setErrorMsg(data.error); setStep('error'); }
                else if (data.status === 'completed') { setSession(data); setVerified(!!data.result?.verified); setDecision(String(data.result?.decision || '')); setStep('complete'); }
                else if (data.status === 'expired') { setErrorMsg('This verification session has expired.'); setStep('error'); }
                else { setSession(data); setStep('welcome'); }
            })
            .catch(() => { setErrorMsg('Failed to load session.'); setStep('error'); });
    }, [sessionId]);

    // Poll for completion (desktop QR flow)
    useEffect(() => {
        if (step !== 'welcome' || isMobile || !sessionId) return;
        const interval = setInterval(() => {
            fetch(`/api/v1/kyc/session/${sessionId}`).then(r => r.json()).then(data => {
                if (data.status === 'completed') { setSession(data); setVerified(!!data.result?.verified); setStep('complete'); }
            }).catch(() => {});
        }, 3000);
        return () => clearInterval(interval);
    }, [step, isMobile, sessionId]);

    // Load face-api models when needed
    const loadModels = useCallback(async () => {
        if (modelsLoaded) return;
        try {
            setProcessingStatus('Loading AI models...');
            faceapi = await import('@vladmandic/face-api');
            await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
            await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
            await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
            setModelsLoaded(true);
        } catch (err) {
            console.error('Failed to load face models:', err);
        }
    }, [modelsLoaded]);

    // Camera controls
    const stopCamera = useCallback(() => {
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
        setCameraActive(false);
    }, []);

    const startCamera = useCallback(async (facing: 'user' | 'environment') => {
        stopCamera();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
            });
            streamRef.current = stream;
            if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
            setCameraActive(true);
        } catch { setErrorMsg('Camera access denied.'); }
    }, [stopCamera]);

    const capturePhoto = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) return null;
        const v = videoRef.current, c = canvasRef.current;
        c.width = v.videoWidth; c.height = v.videoHeight;
        const ctx = c.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(v, 0, 0);
        return c.toDataURL('image/jpeg', 0.85);
    }, []);

    // ─── Document capture & OCR ─────────────────────────────────
    const processDocument = useCallback(async (imageData: string) => {
        setDocumentImage(imageData);
        setStep('processing_doc');

        try {
            // OCR with Tesseract.js
            setProcessingStatus('Extracting text from document...');
            const Tesseract = await import('tesseract.js');
            const { data: { text } } = await Tesseract.recognize(imageData, 'eng', {});
            setOcrText(text);

            // Parse document fields from OCR
            const parsed = parseDocumentText(text);
            setDocumentData(parsed);

            // Try MRZ parsing
            setProcessingStatus('Checking for MRZ...');
            const mrzLines = extractMrzLines(text);
            if (mrzLines.length >= 2) {
                try {
                    const mrzLib = await import('mrz');
                    const mrzResult = mrzLib.parse(mrzLines);
                    setMrzData({
                        valid: mrzResult.valid,
                        format: mrzResult.format || undefined,
                        documentNumber: mrzResult.fields?.documentNumber || undefined,
                        firstName: mrzResult.fields?.firstName || undefined,
                        lastName: mrzResult.fields?.lastName || undefined,
                        dateOfBirth: mrzResult.fields?.birthDate || undefined,
                        expiryDate: mrzResult.fields?.expirationDate || undefined,
                        nationality: mrzResult.fields?.nationality || undefined,
                        sex: mrzResult.fields?.sex || undefined,
                    });

                    // If MRZ has better data, merge
                    if (mrzResult.valid && mrzResult.fields) {
                        setDocumentData(prev => ({
                            ...prev,
                            firstName: mrzResult.fields.firstName ?? prev?.firstName,
                            lastName: mrzResult.fields.lastName ?? prev?.lastName,
                            dateOfBirth: mrzResult.fields.birthDate ?? prev?.dateOfBirth,
                            documentNumber: mrzResult.fields.documentNumber ?? prev?.documentNumber,
                            expiryDate: mrzResult.fields.expirationDate ?? prev?.expiryDate,
                            nationality: mrzResult.fields.nationality ?? prev?.nationality,
                            gender: mrzResult.fields.sex ?? prev?.gender,
                        }));
                    }
                } catch { /* MRZ parse failed, continue */ }
            }

            // Face detection on document (if needed for face matching)
            const level = session?.level || 'document_face';
            if (level !== 'document_only') {
                setProcessingStatus('Detecting face on document...');
                await loadModels();
                if (faceapi) {
                    const img = await createImageElement(imageData);
                    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
                    if (detection) {
                        setFaceOnDoc(true);
                        docDescriptorRef.current = detection.descriptor;
                    }
                }
            }

            setProcessingStatus('');

            if (level === 'document_only') {
                setStep('review');
            } else {
                setStep('selfie');
            }
        } catch (err) {
            console.error('Document processing error:', err);
            setProcessingStatus('');
            // Continue even if OCR fails
            const level = session?.level || 'document_face';
            if (level === 'document_only') setStep('review');
            else setStep('selfie');
        }
    }, [session, loadModels]);

    // ─── Selfie capture & face matching ─────────────────────────
    const processSelfie = useCallback(async (imageData: string) => {
        setSelfieImage(imageData);
        stopCamera();
        setProcessingStatus('Analyzing selfie...');

        try {
            await loadModels();
            if (faceapi) {
                const img = await createImageElement(imageData);
                const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

                if (detection) {
                    setFaceOnSelfie(true);

                    // Compare with document face
                    if (docDescriptorRef.current) {
                        const distance = faceapi.euclideanDistance(docDescriptorRef.current, detection.descriptor);
                        setFaceMatchScore(distance);
                    }
                }
            }
        } catch (err) {
            console.error('Face matching error:', err);
        }

        setProcessingStatus('');
        const level = session?.level || 'document_face';
        if (level === 'full') {
            setStep('liveness');
        } else {
            setStep('review');
        }
    }, [session, stopCamera, loadModels]);

    // ─── Liveness detection (blink challenge) ───────────────────
    const startLiveness = useCallback(async () => {
        await startCamera('user');
        await loadModels();
        setLivenessMsg('Look at the camera and blink naturally...');
        setBlinkCount(0);
        livenessRunning.current = true;

        let blinks = 0;
        let prevEar = 1.0;
        let frameCount = 0;
        const EAR_THRESHOLD = 0.25;
        const maxFrames = 300; // ~10 seconds at 30fps

        const detectBlink = async () => {
            if (!livenessRunning.current || !videoRef.current || !faceapi) return;

            try {
                const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 })).withFaceLandmarks();

                if (detection) {
                    const landmarks = detection.landmarks;
                    const leftEye = landmarks.getLeftEye();
                    const rightEye = landmarks.getRightEye();

                    const earLeft = computeEAR(leftEye);
                    const earRight = computeEAR(rightEye);
                    const ear = (earLeft + earRight) / 2;

                    // Blink = EAR drops below threshold then rises
                    if (prevEar >= EAR_THRESHOLD && ear < EAR_THRESHOLD) {
                        blinks++;
                        setBlinkCount(blinks);
                    }
                    prevEar = ear;
                }
            } catch { /* ignore frame errors */ }

            frameCount++;

            if (blinks >= 2) {
                livenessRunning.current = false;
                setBlinkDetected(true);
                setLivenessPass(true);
                setLivenessMsg('Liveness verified!');
                stopCamera();
                setTimeout(() => setStep('review'), 1000);
                return;
            }

            if (frameCount >= maxFrames) {
                livenessRunning.current = false;
                setLivenessMsg(blinks > 0 ? 'Partial detection. Proceeding...' : 'No blinks detected.');
                setLivenessPass(blinks > 0);
                setBlinkDetected(blinks > 0);
                stopCamera();
                setTimeout(() => setStep('review'), 1500);
                return;
            }

            if (livenessRunning.current) {
                requestAnimationFrame(detectBlink);
            }
        };

        // Wait a moment for camera to stabilize
        setTimeout(() => requestAnimationFrame(detectBlink), 1000);
    }, [startCamera, stopCamera, loadModels]);

    useEffect(() => {
        if (step === 'liveness') startLiveness();
        return () => { livenessRunning.current = false; };
    }, [step, startLiveness]);

    // ─── Submit ─────────────────────────────────────────────────
    const handleSubmit = useCallback(async () => {
        if (!sessionId) return;
        setStep('submitting');

        try {
            const res = await fetch(`/api/v1/kyc/submit/${sessionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentFront: documentImage,
                    documentHash: documentImage ? undefined : undefined,
                    ocrText,
                    documentData,
                    mrzData,
                    selfie: selfieImage,
                    faceMatchScore,
                    faceDetectedOnDocument: faceOnDoc,
                    faceDetectedOnSelfie: faceOnSelfie,
                    livenessResult: session?.level === 'full' ? {
                        passed: livenessPass,
                        blinkDetected,
                        attempts: 1,
                    } : undefined,
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
                setDecision(data.decision);
                setRiskScore(data.riskScore || 0);
                setStep('complete');

                if (session?.redirectUrl) {
                    setTimeout(() => {
                        const url = new URL(session.redirectUrl!);
                        url.searchParams.set('session_id', sessionId);
                        url.searchParams.set('status', 'completed');
                        url.searchParams.set('verified', String(data.verified));
                        url.searchParams.set('decision', data.decision);
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
    }, [sessionId, documentImage, ocrText, documentData, mrzData, selfieImage, faceMatchScore, faceOnDoc, faceOnSelfie, livenessPass, blinkDetected, session]);

    // File upload handler
    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'document' | 'selfie') => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            if (type === 'document') processDocument(reader.result as string);
            else processSelfie(reader.result as string);
        };
        reader.readAsDataURL(file);
    }, [processDocument, processSelfie]);

    const verifyUrl = typeof window !== 'undefined' ? window.location.href : '';
    const level = session?.level || 'document_face';

    const totalSteps = level === 'document_only' ? 2 : level === 'document_face' ? 3 : 4;
    const stepLabels = level === 'document_only'
        ? ['Document', 'Review']
        : level === 'document_face'
            ? ['Document', 'Selfie', 'Review']
            : ['Document', 'Selfie', 'Liveness', 'Review'];

    const _currentStepIdx =
        step === 'document' || step === 'processing_doc' ? 0
            : step === 'selfie' ? 1
                : step === 'liveness' ? 2
                    : step === 'review' ? totalSteps - 1 : 0;
    void _currentStepIdx;

    // ─── Styles ─────────────────────────────────────────────────
    const containerStyle: React.CSSProperties = { minHeight: '100vh', background: '#0a0a0f', color: '#e4e4e7', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' };
    const cardStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '32px', maxWidth: '500px', width: '100%', textAlign: 'center' };
    const btnPrimary: React.CSSProperties = { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', border: 'none', borderRadius: '10px', padding: '14px 28px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', width: '100%', marginTop: '16px' };
    const btnSecondary: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px 24px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: '12px' };
    const infoBox: React.CSSProperties = { background: 'rgba(99,102,241,0.08)', borderRadius: '10px', padding: '12px 16px', marginBottom: '12px', textAlign: 'left', fontSize: '13px', color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '8px' };

    const progressBar = (current: number) => (
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '24px' }}>
            {stepLabels.map((label, i) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{
                        width: '26px', height: '26px', borderRadius: '50%',
                        background: i < current ? '#10b981' : i === current ? '#6366f1' : 'rgba(255,255,255,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 700, color: 'white',
                    }}>{i < current ? '✓' : i + 1}</div>
                    <span style={{ fontSize: '11px', color: i <= current ? '#e4e4e7' : '#52525b' }}>{label}</span>
                    {i < stepLabels.length - 1 && <div style={{ width: '16px', height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />}
                </div>
            ))}
        </div>
    );

    return (
        <div style={containerStyle}>
            <div style={{ marginBottom: '24px', marginTop: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                    🛡️ <span style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TrialShield</span>
                </div>
                <div style={{ fontSize: '12px', color: '#71717a', marginTop: '4px' }}>Identity Verification</div>
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Loading */}
            {step === 'loading' && <div style={cardStyle}><div style={{ fontSize: '32px' }}>⏳</div><p style={{ color: '#a1a1aa', marginTop: '12px' }}>Loading verification session...</p></div>}

            {/* Error */}
            {step === 'error' && <div style={cardStyle}><div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div><h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Verification Error</h2><p style={{ color: '#a1a1aa', lineHeight: '1.6' }}>{errorMsg}</p></div>}

            {/* Welcome */}
            {step === 'welcome' && (
                <div style={cardStyle}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>🪪</div>
                    <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '6px' }}>Verify Your Identity</h2>
                    <p style={{ color: '#a1a1aa', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
                        {level === 'full' ? 'Complete identity verification with document scan, face matching, and liveness check.' :
                            level === 'document_face' ? 'Verify your identity with a document scan and face match.' :
                                'Verify your identity by scanning your document.'}
                    </p>

                    <div style={{ background: 'rgba(99,102,241,0.08)', borderRadius: '12px', padding: '16px', marginBottom: '20px', textAlign: 'left' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>What you&apos;ll need:</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#a1a1aa' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>🪪 A valid government-issued ID (passport, driver&apos;s license, or national ID)</div>
                            {level !== 'document_only' && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>📸 A clear selfie of your face</div>}
                            {level === 'full' && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>👁️ A quick liveness check (blink twice)</div>}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>💡 Good lighting</div>
                        </div>
                    </div>

                    <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '11px', color: '#52525b', marginBottom: '16px' }}>
                        Verification level: <span style={{ color: '#6366f1', fontWeight: 700, textTransform: 'uppercase' }}>{level.replace(/_/g, ' ')}</span>
                    </div>

                    <button style={btnPrimary} onClick={() => setStep('document')}>Start Verification</button>

                    {!isMobile && (
                        <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <p style={{ fontSize: '12px', color: '#71717a', marginBottom: '12px' }}>Or scan to verify on your phone</p>
                            <div style={{ display: 'inline-block', padding: '10px', background: 'white', borderRadius: '10px' }}>
                                <QRCodeSVG value={verifyUrl} size={140} level="M" />
                            </div>
                            <p style={{ fontSize: '10px', color: '#3f3f46', marginTop: '8px' }}>This page updates automatically when you complete on mobile.</p>
                        </div>
                    )}

                    <p style={{ fontSize: '10px', color: '#3f3f46', marginTop: '16px', lineHeight: '1.4' }}>
                        Your data is processed securely. All images are analyzed client-side and hashed before storage.
                    </p>
                </div>
            )}

            {/* Document Capture */}
            {step === 'document' && (
                <div style={{ ...cardStyle, padding: '24px' }}>
                    {progressBar(0)}
                    <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Scan Your ID Document</h2>
                    <p style={{ fontSize: '13px', color: '#71717a', marginBottom: '16px' }}>Place the front of your ID within the frame. Ensure all text is readable.</p>

                    {cameraActive ? (
                        <>
                            <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '2px solid rgba(99,102,241,0.3)', marginBottom: '16px' }}>
                                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block' }} />
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '88%', height: '62%', border: '2px dashed rgba(99,102,241,0.5)', borderRadius: '12px' }} />
                                <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', fontSize: '11px', color: '#a1a1aa', background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: '6px' }}>Align your document within the frame</div>
                            </div>
                            <button style={btnPrimary} onClick={() => { const d = capturePhoto(); if (d) { stopCamera(); processDocument(d); } }}>📸 Capture Document</button>
                        </>
                    ) : (
                        <button style={btnPrimary} onClick={() => startCamera('environment')}>📷 Open Camera</button>
                    )}

                    <label style={{ ...btnSecondary, display: 'block', textAlign: 'center', cursor: 'pointer' }}>
                        📁 Upload from files
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, 'document')} />
                    </label>
                </div>
            )}

            {/* Processing Document */}
            {step === 'processing_doc' && (
                <div style={cardStyle}>
                    <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔍</div>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Analyzing Document</h2>
                    <p style={{ color: '#a1a1aa', fontSize: '14px', marginBottom: '16px' }}>{processingStatus || 'Processing...'}</p>
                    <div style={{ width: '60%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', margin: '0 auto', overflow: 'hidden' }}>
                        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, #6366f1, #a855f7)', animation: 'loading 1.5s infinite', borderRadius: '2px' }} />
                    </div>
                    <style>{`@keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`}</style>
                </div>
            )}

            {/* Selfie Capture */}
            {step === 'selfie' && (
                <div style={{ ...cardStyle, padding: '24px' }}>
                    {progressBar(1)}
                    <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Take a Selfie</h2>
                    <p style={{ fontSize: '13px', color: '#71717a', marginBottom: '12px' }}>Position your face in the center. We&apos;ll compare it with your document photo.</p>

                    {documentData?.fullName && <div style={infoBox}>✅ Document: {documentData.fullName}</div>}
                    {mrzData?.valid && <div style={infoBox}>✅ MRZ validated</div>}
                    {faceOnDoc && <div style={infoBox}>✅ Face detected on document</div>}
                    {!faceOnDoc && <div style={{ ...infoBox, background: 'rgba(245,158,11,0.08)' }}>⚠️ No face detected on document — comparison may not work</div>}

                    {cameraActive ? (
                        <>
                            <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '2px solid rgba(99,102,241,0.3)', marginBottom: '16px' }}>
                                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block', transform: 'scaleX(-1)' }} />
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '180px', height: '220px', border: '2px dashed rgba(99,102,241,0.5)', borderRadius: '50%' }} />
                            </div>
                            <button style={btnPrimary} onClick={() => { const d = capturePhoto(); if (d) processSelfie(d); }}>📸 Capture Selfie</button>
                        </>
                    ) : (
                        <button style={btnPrimary} onClick={() => startCamera('user')}>📷 Open Camera</button>
                    )}

                    <label style={{ ...btnSecondary, display: 'block', textAlign: 'center', cursor: 'pointer' }}>
                        📁 Upload from files
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, 'selfie')} />
                    </label>
                </div>
            )}

            {/* Liveness Detection */}
            {step === 'liveness' && (
                <div style={{ ...cardStyle, padding: '24px' }}>
                    {progressBar(2)}
                    <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Liveness Check</h2>
                    <p style={{ fontSize: '13px', color: '#71717a', marginBottom: '16px' }}>{livenessMsg}</p>

                    <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: livenessPass ? '2px solid #10b981' : '2px solid rgba(99,102,241,0.3)', marginBottom: '16px' }}>
                        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block', transform: 'scaleX(-1)' }} />
                        <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.7)', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 700 }}>
                            Blinks: {blinkCount}/2
                        </div>
                    </div>

                    {livenessPass && <div style={infoBox}>✅ Liveness verified — you are a real person</div>}
                </div>
            )}

            {/* Review */}
            {step === 'review' && (
                <div style={{ ...cardStyle, padding: '24px' }}>
                    {progressBar(totalSteps - 1)}
                    <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Review & Submit</h2>

                    {/* Document preview */}
                    <div style={{ display: 'grid', gridTemplateColumns: level === 'document_only' ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div>
                            <div style={{ fontSize: '11px', color: '#71717a', marginBottom: '4px', fontWeight: 600 }}>ID DOCUMENT</div>
                            <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                {documentImage && <img src={documentImage} alt="Document" style={{ width: '100%', display: 'block' }} />}
                            </div>
                        </div>
                        {selfieImage && (
                            <div>
                                <div style={{ fontSize: '11px', color: '#71717a', marginBottom: '4px', fontWeight: 600 }}>SELFIE</div>
                                <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={selfieImage} alt="Selfie" style={{ width: '100%', display: 'block', transform: 'scaleX(-1)' }} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Extracted data */}
                    <div style={{ textAlign: 'left', marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#71717a', marginBottom: '8px' }}>ANALYSIS RESULTS</div>
                        {(documentData?.fullName || documentData?.firstName) && (
                            <div style={infoBox}>👤 {documentData.fullName || `${documentData.firstName} ${documentData.lastName}`}</div>
                        )}
                        {documentData?.dateOfBirth && <div style={infoBox}>📅 DOB: {documentData.dateOfBirth}</div>}
                        {documentData?.documentNumber && <div style={infoBox}>🔢 Doc #: {documentData.documentNumber}</div>}
                        {documentData?.nationality && <div style={infoBox}>🌍 Nationality: {documentData.nationality}</div>}
                        {mrzData?.valid && <div style={{ ...infoBox, background: 'rgba(16,185,129,0.08)' }}>✅ MRZ validated ({mrzData.format})</div>}
                        {mrzData && !mrzData.valid && <div style={{ ...infoBox, background: 'rgba(245,158,11,0.08)' }}>⚠️ MRZ present but invalid</div>}
                        {faceOnDoc && <div style={{ ...infoBox, background: 'rgba(16,185,129,0.08)' }}>✅ Face detected on document</div>}
                        {faceOnSelfie && <div style={{ ...infoBox, background: 'rgba(16,185,129,0.08)' }}>✅ Face detected in selfie</div>}
                        {faceMatchScore !== null && (
                            <div style={{ ...infoBox, background: faceMatchScore < 0.45 ? 'rgba(16,185,129,0.08)' : faceMatchScore < 0.6 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)' }}>
                                {faceMatchScore < 0.45 ? '✅' : faceMatchScore < 0.6 ? '⚠️' : '❌'} Face match: {((1 - faceMatchScore) * 100).toFixed(0)}% similarity
                            </div>
                        )}
                        {level === 'full' && (
                            <div style={{ ...infoBox, background: livenessPass ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)' }}>
                                {livenessPass ? '✅' : '❌'} Liveness: {livenessPass ? 'Passed' : 'Failed'} (blinks: {blinkCount})
                            </div>
                        )}
                        {!documentData?.fullName && !documentData?.firstName && !mrzData?.valid && (
                            <div style={{ ...infoBox, background: 'rgba(245,158,11,0.08)' }}>⚠️ Could not extract text from document — ensure the image is clear</div>
                        )}
                    </div>

                    <button style={btnPrimary} onClick={handleSubmit}>✅ Submit Verification</button>
                    <button style={btnSecondary} onClick={() => { setDocumentImage(null); setSelfieImage(null); setDocumentData(null); setMrzData(null); setOcrText(''); setFaceMatchScore(null); setFaceOnDoc(false); setFaceOnSelfie(false); setLivenessPass(false); setBlinkCount(0); docDescriptorRef.current = null; setStep('document'); }}>
                        🔄 Start Over
                    </button>
                </div>
            )}

            {/* Submitting */}
            {step === 'submitting' && (
                <div style={cardStyle}>
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>⏳</div>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>Submitting Verification</h2>
                    <p style={{ color: '#a1a1aa', fontSize: '13px' }}>Running final analysis...</p>
                </div>
            )}

            {/* Complete */}
            {step === 'complete' && (
                <div style={cardStyle}>
                    <div style={{ fontSize: '56px', marginBottom: '12px' }}>
                        {decision === 'VERIFIED' ? '✅' : decision === 'REVIEW' ? '🔍' : '❌'}
                    </div>
                    <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '6px' }}>
                        {decision === 'VERIFIED' ? 'Identity Verified' :
                            decision === 'REVIEW' ? 'Under Review' : 'Verification Failed'}
                    </h2>
                    <p style={{ color: '#a1a1aa', fontSize: '14px', lineHeight: '1.6', marginBottom: '16px' }}>
                        {decision === 'VERIFIED' ? 'Your identity has been verified successfully. You can close this page.' :
                            decision === 'REVIEW' ? 'Your submission needs manual review. The service provider will follow up.' :
                                'We could not verify your identity. Please contact the service provider for assistance.'}
                    </p>

                    {session?.redirectUrl && <p style={{ fontSize: '13px', color: '#6366f1' }}>Redirecting you back...</p>}

                    <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '11px', color: '#3f3f46' }}>
                        Session: {sessionId?.slice(0, 8)}... · Powered by TrialShield
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Helper: parse document text ────────────────────────────────
function parseDocumentText(text: string): DocumentData {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const data: DocumentData = {};

    for (const line of lines) {
        const lower = line.toLowerCase();

        // Name patterns
        if (/\b(name|nombre|nom)\b/i.test(lower) && line.includes(':')) {
            data.fullName = line.split(':').slice(1).join(':').trim();
        }
        if (/\b(first\s*name|given\s*name|prenom)\b/i.test(lower)) {
            data.firstName = line.split(/[:]/)[1]?.trim() || line.replace(/first\s*name|given\s*name|prenom/i, '').trim();
        }
        if (/\b(last\s*name|surname|family\s*name|apellido)\b/i.test(lower)) {
            data.lastName = line.split(/[:]/)[1]?.trim() || line.replace(/last\s*name|surname|family\s*name|apellido/i, '').trim();
        }

        // Date of birth
        if (/\b(date\s*of\s*birth|dob|birth\s*date|fecha.*nacimiento|born)\b/i.test(lower)) {
            const dateMatch = line.match(/\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/) || line.match(/\d{4}[\/-]\d{2}[\/-]\d{2}/);
            if (dateMatch) data.dateOfBirth = dateMatch[0];
        }

        // Document number
        if (/\b(document\s*no|doc\s*no|passport\s*no|license\s*no|id\s*no|numero)\b/i.test(lower)) {
            const numMatch = line.match(/[A-Z0-9]{5,15}/);
            if (numMatch) data.documentNumber = numMatch[0];
        }

        // Expiry
        if (/\b(expir|vencimiento|valid\s*until|date\s*of\s*expiry)\b/i.test(lower)) {
            const dateMatch = line.match(/\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/) || line.match(/\d{4}[\/-]\d{2}[\/-]\d{2}/);
            if (dateMatch) data.expiryDate = dateMatch[0];
        }

        // Nationality
        if (/\b(nationality|nacionalidad|nationalite)\b/i.test(lower)) {
            data.nationality = line.split(/[:]/)[1]?.trim() || line.replace(/nationality|nacionalidad|nationalite/i, '').trim();
        }

        // Gender
        if (/\b(sex|gender|sexo)\b/i.test(lower)) {
            if (/\b[MF]\b/.test(line)) data.gender = line.match(/\b([MF])\b/)?.[1];
        }
    }

    return data;
}

// ─── Helper: extract MRZ lines from OCR text ────────────────────
function extractMrzLines(text: string): string[] {
    const lines = text.split('\n').map(l => l.trim());
    const mrzPattern = /^[A-Z0-9<]{30,44}$/;
    const mrzLines = lines.filter(l => mrzPattern.test(l.replace(/\s/g, '')));

    if (mrzLines.length >= 2) {
        return mrzLines.slice(0, mrzLines[0].length > 36 ? 2 : 3)
            .map(l => l.replace(/\s/g, ''));
    }
    return [];
}

// ─── Helper: create image element from data URL ─────────────────
function createImageElement(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

// ─── Helper: Eye Aspect Ratio for blink detection ───────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeEAR(eye: any[]): number {
    if (!eye || eye.length < 6) return 1.0;
    const p = eye.map((pt: { x: number; y: number }) => [pt.x, pt.y]);
    const v1 = Math.hypot(p[1][0] - p[5][0], p[1][1] - p[5][1]);
    const v2 = Math.hypot(p[2][0] - p[4][0], p[2][1] - p[4][1]);
    const h = Math.hypot(p[0][0] - p[3][0], p[0][1] - p[3][1]);
    return h > 0 ? (v1 + v2) / (2.0 * h) : 1.0;
}
