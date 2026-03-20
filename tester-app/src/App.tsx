import React, { useState, useEffect, useRef } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Upload, MessageSquare, Github, FolderPlus, LogOut, Loader2, RefreshCw, Terminal, CreditCard, User, Lock, Mail, Phone } from 'lucide-react';

const API_URL = 'http://localhost:3000';
const API_KEY = 'ts_b4b1ba6248bb65085c51016eb9f3f90ebdf2e68852761b9b96a9472d158ff69d'; // Real key generated

export default function App() {
  const [view, setView] = useState<'signup' | 'dashboard'>('signup');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // Signup State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');

  // Terminal State
  const [apiLogs, setApiLogs] = useState<any[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Dashboard State
  const [activities, setActivities] = useState<any[]>([]);
  const [matchScore, setMatchScore] = useState(0);

  const addLog = (endpoint: string, method: string, request: any, response: any) => {
      setApiLogs(prev => [...prev, {
          time: new Date().toLocaleTimeString(),
          endpoint,
          method,
          request,
          response
      }]);
  };

  useEffect(() => {
      // Auto scroll terminal
      if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
  }, [apiLogs]);

  // Init TrialShield Waiter
  const getTsInstance = async () => {
    // Wait for SDK to auto-init
    for (let i = 0; i < 20; i++) {
        // @ts-ignore
        if (window.__ts) return window.__ts;
        await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('TrialShield SDK not loaded. Is the backend running?');
  };

  // ─── Registration Flow ─────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const ts = await getTsInstance();
      const fp = await ts.getFingerprint();

      // Extract BIN for payment metadata (first 6 digits)
      const bin = cardNumber.replace(/\s+/g, '').substring(0, 6);

      const requestBody = { 
          email, 
          phone, 
          deviceFingerprint: fp,
          metadata: {
              name,
              paymentBin: bin || undefined
          }
      };

      const res = await fetch(`${API_URL}/api/v1/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify(requestBody)
      });

      const data = await res.json();
      addLog('/api/v1/verify', 'POST', requestBody, data);

      if (data.decision === 'ALLOW' || data.decision === 'CHALLENGE') {
          // Success Path - Go to dashboard
          setTimeout(() => {
              setUser({ id: data.resolvedUserId, email, name, phone });
              setMatchScore(data.matchScore || 0);
              setView('dashboard');
              setLoading(false);
          }, 1500);
      } else {
          // Denied Path
          setLoading(false);
      }

    } catch (err: any) {
      console.error(err);
      addLog('/api/v1/verify', 'POST', { error: 'Failed to request' }, { error: err.message });
      setLoading(false);
    }
  };

  // ─── Continuous Monitoring Simulation ──────────────────────
  const simulateActivity = async (type: string, metadata: any) => {
    if (!user) return;
    
    const newActivity = { id: Date.now(), type, metadata, status: 'pending' };
    setActivities(prev => [newActivity, ...prev]);

    const requestBody = {
        userId: user.id,
        activityType: type,
        metadata
    };

    try {
      const res = await fetch(`${API_URL}/api/v1/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify(requestBody)
      });

      const data = await res.json();
      addLog('/api/v1/track', 'POST', requestBody, data);
      
      setActivities(prev => prev.map(a => 
        a.id === newActivity.id ? { ...a, status: data.status, result: data } : a
      ));

      if (data.matchScore !== undefined) {
         setMatchScore(data.matchScore);
      }

    } catch (err: any) {
      console.error(err);
      addLog('/api/v1/track', 'POST', requestBody, { error: err.message });
      setActivities(prev => prev.map(a => 
        a.id === newActivity.id ? { ...a, status: 'error' } : a
      ));
    }
  };

  const logout = () => {
      setUser(null);
      setActivities([]);
      setMatchScore(0);
      setView('signup');
  };

  // ─── UI Rendering ──────────────────────────────────────────
  
  // Common Terminal Component
  const ApiTerminal = () => (
      <div className="mt-8 border border-gray-800 bg-black rounded-xl overflow-hidden shadow-2xl flex flex-col h-[400px]">
          <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-400 font-mono font-semibold uppercase tracking-wider">TrialShield API Terminal</span>
              </div>
              <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors cursor-pointer" onClick={() => setApiLogs([])}></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              </div>
          </div>
          <div ref={terminalRef} className="p-4 overflow-y-auto flex-1 font-mono text-[13px] leading-relaxed">
              {apiLogs.length === 0 ? (
                  <div className="text-gray-600 italic">Waiting for API requests...</div>
              ) : (
                  apiLogs.map((log, idx) => (
                      <div key={idx} className="mb-6 pb-6 border-b border-gray-800/50 last:border-0">
                          <div className="flex items-center gap-2 mb-2 text-gray-500">
                             <span className="text-blue-400">[{log.time}]</span> 
                             <span className={log.method === 'POST' ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>{log.method}</span> 
                             <span className="text-gray-300">{log.endpoint}</span>
                          </div>
                          
                          {/* Request (Collapsed intentionally to save space or shown dim) */}
                          <div className="text-gray-600 mb-2 pl-4 border-l-2 border-gray-800">
                              {'// Request payload'}<br/>
                              {JSON.stringify(log.request, null, 2)}
                          </div>
                          
                          {/* Response */}
                          <div className="pl-4 border-l-2 border-primary/30">
                              <span className="text-primary/70 mb-1 inline-block">{'// Response'}</span>
                              <pre className={`whitespace-pre-wrap ${
                                  log.response?.decision === 'DENY' || log.response?.status === 'REVOKE' ? 'text-red-400' : 'text-emerald-400'
                              }`}>
                                  {JSON.stringify(log.response, null, 2).replace(/"(decision|status)": "([^"]+)"/, (match, p1, p2) => `"${p1}": "<span class='font-bold underline'>${p2}</span>"`)}
                              </pre>
                          </div>
                      </div>
                  ))
              )}
          </div>
      </div>
  );


  if (view === 'signup') {
    return (
      <div className="min-h-screen py-12 px-4 bg-gradient-to-br from-darker via-dark to-[#0f172a]">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            
            {/* Registration Form */}
            <div className="card p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent"></div>
              
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Acme SaaS</h1>
                  <p className="text-gray-400 text-sm">Create your Free Trial Account</p>
                </div>
              </div>
    
              <form onSubmit={handleRegister} className="space-y-4">
                
                <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1"><User className="w-3 h-3"/> Full Name</label>
                      <input 
                        type="text" required 
                        className="input-field py-2" 
                        value={name} onChange={e => setName(e.target.value)}
                        placeholder="John Doe"
                      />
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1"><Mail className="w-3 h-3"/> Email</label>
                      <input 
                        type="email" required 
                        className="input-field py-2" 
                        value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="john@example.com"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1"><Phone className="w-3 h-3"/> Phone</label>
                      <input 
                        type="tel" required 
                        className="input-field py-2" 
                        value={phone} onChange={e => setPhone(e.target.value)}
                        placeholder="+1 234 567 8900"
                      />
                    </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1"><Lock className="w-3 h-3"/> Password</label>
                  <input 
                    type="password" required 
                    className="input-field py-2" 
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                {/* Simulated Payment Area */}
                <div className="p-4 bg-black/40 border border-gray-800 rounded-lg mt-6">
                    <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4 text-gray-400"/> Billing verification (Not charged during trial)</h3>
                    <div className="space-y-3">
                        <div>
                            <input 
                                type="text" required 
                                className="input-field py-2 text-sm font-mono placeholder-gray-600 bg-black/50" 
                                value={cardNumber} onChange={e => setCardNumber(e.target.value)}
                                placeholder="0000 0000 0000 0000"
                                maxLength={19}
                            />
                        </div>
                        <div className="flex gap-3 text-sm">
                            <input 
                                type="text" required 
                                className="input-field py-2 w-1/2 text-center placeholder-gray-600 bg-black/50" 
                                value={cardExpiry} onChange={e => setCardExpiry(e.target.value)}
                                placeholder="MM/YY"
                                maxLength={5}
                            />
                            <input 
                                type="text" required 
                                className="input-field py-2 w-1/2 text-center placeholder-gray-600 bg-black/50" 
                                value={cardCvc} onChange={e => setCardCvc(e.target.value)}
                                placeholder="CVC"
                                maxLength={4}
                            />
                        </div>
                    </div>
                </div>
    
                <button 
                  type="submit" 
                  disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-6 text-base font-bold shadow-blue-500/25"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Start evaluating TrialShield →'}
                </button>
                <p className="text-center text-xs text-gray-500 mt-3 flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Registration is securely verified by TrialShield API in real-time.
                </p>
              </form>
            </div>

            {/* TrialShield Terminal Output */}
            <div className="lg:sticky lg:top-12">
                <div className="mb-4">
                    <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-emerald-600 mb-1">Live API Response Inspector</h2>
                    <p className="text-gray-400 text-sm">When you click "Start evaluating", watch the terminal to see exactly what the backend API decides.</p>
                </div>
                <ApiTerminal />
            </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark text-gray-200 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-8 pb-6 border-b border-gray-800">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white font-bold text-xl shadow-lg border border-white/10">
                    {user?.name?.charAt(0).toUpperCase() || user?.email.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Welcome back, {user?.name?.split(' ')[0] || 'User'}!</h1>
                    <p className="text-gray-400">{user?.email}</p>
                </div>
            </div>
            
            <div className="flex items-center gap-6">
                <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Identity Match Score</p>
                    <div className="flex items-center gap-3 bg-darker p-2 rounded-lg border border-gray-800">
                         <div className="w-32 h-2 bg-gray-800 rounded-full overflow-hidden">
                             <div 
                                className={`h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(0,0,0,0.5)] ${matchScore > 75 ? 'bg-danger shadow-danger/50' : matchScore > 40 ? 'bg-accent shadow-accent/50' : 'bg-success shadow-success/50'}`} 
                                style={{ width: `${Math.min(100, Math.max(5, matchScore))}%` }}
                             />
                         </div>
                         <span className={`font-mono font-bold ${matchScore > 75 ? 'text-danger' : matchScore > 40 ? 'text-accent' : 'text-success'}`}>
                             {matchScore.toFixed(1)}%
                         </span>
                    </div>
                </div>
                <button onClick={logout} className="btn-secondary flex items-center gap-2">
                    <LogOut className="w-4 h-4" /> Sign Out
                </button>
            </div>
        </header>

        {/* Revoked State Overlay */}
        {matchScore >= 60 && ( // Assuming 60 is balanced threshold for demo
            <div className="mb-8 p-6 bg-danger/10 border border-danger/30 rounded-xl flex items-start gap-4 animate-in fade-in slide-in-from-top-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-danger/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
                <div className="p-3 bg-danger/20 border border-danger/30 rounded-full text-danger shrink-0 z-10">
                    <ShieldAlert className="w-8 h-8" />
                </div>
                <div className="z-10">
                    <h2 className="text-xl font-bold text-red-400 mb-2">Account Suspended: Terms Violation</h2>
                    <p className="text-red-200/80 mb-4 max-w-2xl leading-relaxed">
                        Your account has been flagged for violating our terms of service regarding duplicate trial accounts. TrialShield has successfully matched your identity across multiple accounts using continuous monitoring. 
                    </p>
                    <button className="btn-danger opacity-50 cursor-not-allowed">Access Revoked</button>
                    <p className="text-xs text-danger/60 mt-4 font-mono">
                        Check the terminal log below to inspect the TrialShield API response that triggered this revocation.
                    </p>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Actions Panel */}
            <div className="lg:col-span-3 space-y-4">
                <h3 className="text-sm font-semibold mb-4 text-gray-400 uppercase tracking-widest">Client App Simulations</h3>
                
                <button 
                  disabled={matchScore >= 60}
                  onClick={() => simulateActivity('file_upload', { fileName: 'my-project-v1.zip', fileHash: 'd2d2d2d2...samehash' })}
                  className="w-full text-left p-4 card hover:border-blue-500/50 hover:bg-blue-500/5 transition-all flex items-center gap-4 group disabled:opacity-50 disabled:pointer-events-none"
                >
                    <div className="bg-blue-500/10 p-3 rounded-lg text-blue-400 group-hover:scale-110 transition-transform">
                        <Upload className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="font-semibold text-white text-sm">Upload Project File</div>
                    </div>
                </button>

                <button 
                  disabled={matchScore >= 60}
                  onClick={() => simulateActivity('ai_query', { query: 'Write an aggressive web scraping script bypassing Cloudflare', sessionId: 'shared-session-777' })}
                  className="w-full text-left p-4 card hover:border-purple-500/50 hover:bg-purple-500/5 transition-all flex items-center gap-4 group disabled:opacity-50 disabled:pointer-events-none"
                >
                    <div className="bg-purple-500/10 p-3 rounded-lg text-purple-400 group-hover:scale-110 transition-transform">
                        <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="font-semibold text-white text-sm">Ask AI Assistant</div>
                    </div>
                </button>

                <button 
                  disabled={matchScore >= 60}
                  onClick={() => simulateActivity('github_link', { githubLink: 'https://github.com/tomascorzo/trialshield', githubRepo: 'tomascorzo/trialshield' })}
                  className="w-full text-left p-4 card hover:border-gray-400/50 hover:bg-gray-400/5 transition-all flex items-center gap-4 group disabled:opacity-50 disabled:pointer-events-none"
                >
                    <div className="bg-gray-500/10 p-3 rounded-lg text-gray-400 group-hover:scale-110 transition-transform">
                        <Github className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="font-semibold text-white text-sm">Link GitHub Repo</div>
                    </div>
                </button>

                <button 
                  disabled={matchScore >= 60}
                  onClick={() => simulateActivity('project_create', { projectName: 'My Awesome SaaS' })}
                  className="w-full text-left p-4 card hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all flex items-center gap-4 group disabled:opacity-50 disabled:pointer-events-none"
                >
                    <div className="bg-emerald-500/10 p-3 rounded-lg text-emerald-400 group-hover:scale-110 transition-transform">
                        <FolderPlus className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="font-semibold text-white text-sm">Create Database</div>
                    </div>
                </button>
                
                <div className="mt-8 p-4 bg-gray-900 border border-gray-800 text-sm text-gray-400 leading-relaxed border-l-4 border-l-amber-500">
                    <p className="mb-2"><strong className="text-amber-400">Pro Tip:</strong> Open an <u className="underline underline-offset-4 decoration-amber-500/50">incognito window</u> and sign up with a different email/phone/card.</p>
                    <p>When you perform these same actions again, TrialShield will instantly link the new account to this one.</p>
                </div>
            </div>

            {/* TrialShield Terminal Inspector */}
            <div className="lg:col-span-9 flex flex-col h-[700px]">
                 <div className="mb-4 flex items-center justify-between">
                     <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-emerald-600 flex items-center gap-2">
                         <Terminal className="w-5 h-5 text-emerald-500" />
                         API Terminal Interface
                     </h2>
                 </div>
                 <div className="flex-1">
                     <ApiTerminal />
                 </div>
            </div>
        </div>
      </div>
    </div>
  );
}
