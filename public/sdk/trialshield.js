/**
 * TrialShield Client SDK v1.0.0
 * Device Fingerprinting + Behavioral Biometrics
 * 
 * Include this script on your signup/login page:
 * <script src="https://your-domain.com/sdk/trialshield.js"></script>
 * 
 * Usage:
 * const ts = new TrialShield({ apiKey: 'ts_xxx', apiUrl: 'https://your-api.com' });
 * const result = await ts.verify({ email: 'user@example.com', phone: '+1234567890' });
 * 
 * result.decision → 'ALLOW' | 'DENY' | 'CHALLENGE'
 * result.riskScore → 0-100
 */

(function (window) {
    'use strict';

    // ─── TrialShield Class ─────────────────────────────────────
    function TrialShield(config) {
        this.apiKey = config.apiKey || '';
        this.apiUrl = (config.apiUrl || '').replace(/\/$/, '');
        this.sessionId = generateSessionId();
        this.startTime = Date.now();
        this.mouseEvents = [];
        this.keystrokeTimings = [];
        this.touchEvents = [];

        // Start behavioral tracking
        this._initBehaviorTracking();
    }

    // ─── Verify User ───────────────────────────────────────────
    TrialShield.prototype.verify = async function (userData) {
        var fingerprint = await this.getFingerprint();
        var behavioral = this.getBehavioralData();

        var payload = {
            email: userData.email || undefined,
            phone: userData.phone || undefined,
            ip: undefined, // Server will detect
            deviceFingerprint: fingerprint,
            sessionId: this.sessionId,
            userAgent: navigator.userAgent,
            metadata: {
                mouseEntropy: behavioral.mouseEntropy,
                keystrokePattern: behavioral.keystrokeVariance,
                timeOnPage: Date.now() - this.startTime,
            }
        };

        try {
            var response = await fetch(this.apiUrl + '/api/v1/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.apiKey,
                },
                body: JSON.stringify(payload),
            });

            return await response.json();
        } catch (error) {
            console.error('[TrialShield] Verification failed:', error);
            return { decision: 'ALLOW', riskScore: 0, error: true };
        }
    };

    // ─── Device Fingerprint ────────────────────────────────────
    TrialShield.prototype.getFingerprint = async function () {
        var components = {};

        // Canvas fingerprint
        try {
            components.canvas = getCanvasFingerprint();
        } catch (e) { components.canvas = null; }

        // WebGL fingerprint
        try {
            components.webgl = getWebGLFingerprint();
        } catch (e) { components.webgl = null; }

        // Audio fingerprint
        try {
            components.audio = await getAudioFingerprint();
        } catch (e) { components.audio = null; }

        // Font detection
        try {
            components.fonts = detectFonts();
        } catch (e) { components.fonts = []; }

        // Screen info
        components.screen = {
            width: screen.width,
            height: screen.height,
            colorDepth: screen.colorDepth,
        };

        // Platform info
        components.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        components.language = navigator.language;
        components.platform = navigator.platform;
        components.hardwareConcurrency = navigator.hardwareConcurrency || 0;
        components.deviceMemory = navigator.deviceMemory || 0;
        components.touchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        components.plugins = getPlugins();
        components.userAgent = navigator.userAgent;

        // Headless detection
        components.headless = detectHeadless();
        components.automationDetected = detectAutomation();
        components.spoofingDetected = detectSpoofing(components);

        // Generate stable ID from all components
        components.id = await hashComponents(components);

        return components;
    };

    // ─── Canvas Fingerprint ────────────────────────────────────
    function getCanvasFingerprint() {
        var canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 50;
        var ctx = canvas.getContext('2d');

        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('TrialShield fp', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('TrialShield fp', 4, 17);

        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = 'rgb(255, 0, 255)';
        ctx.beginPath();
        ctx.arc(50, 50, 50, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fill();

        return canvas.toDataURL();
    }

    // ─── WebGL Fingerprint ─────────────────────────────────────
    function getWebGLFingerprint() {
        var canvas = document.createElement('canvas');
        var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return null;

        var debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        return {
            vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown',
            renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown',
            version: gl.getParameter(gl.VERSION),
            shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
            maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
            maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
        };
    }

    // ─── Audio Fingerprint ─────────────────────────────────────
    function getAudioFingerprint() {
        return new Promise(function (resolve) {
            try {
                var AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) { resolve(null); return; }

                var context = new AudioContext();
                var oscillator = context.createOscillator();
                var analyser = context.createAnalyser();
                var gain = context.createGain();
                var scriptProcessor = context.createScriptProcessor(4096, 1, 1);

                gain.gain.value = 0;
                oscillator.type = 'triangle';
                oscillator.connect(analyser);
                analyser.connect(scriptProcessor);
                scriptProcessor.connect(gain);
                gain.connect(context.destination);
                oscillator.start(0);

                scriptProcessor.onaudioprocess = function (event) {
                    var output = event.inputBuffer.getChannelData(0);
                    var sum = 0;
                    for (var i = 0; i < output.length; i++) {
                        sum += Math.abs(output[i]);
                    }
                    oscillator.disconnect();
                    scriptProcessor.disconnect();
                    gain.disconnect();
                    context.close();
                    resolve(sum.toString());
                };

                setTimeout(function () { resolve(null); }, 1000);
            } catch (e) {
                resolve(null);
            }
        });
    }

    // ─── Font Detection ────────────────────────────────────────
    function detectFonts() {
        var testFonts = [
            'Arial', 'Arial Black', 'Courier', 'Courier New', 'Georgia',
            'Helvetica', 'Impact', 'Lucida Console', 'Lucida Sans Unicode',
            'Palatino Linotype', 'Tahoma', 'Times New Roman', 'Trebuchet MS',
            'Verdana', 'Comic Sans MS', 'Consolas', 'Cambria', 'Calibri',
            'Century Gothic', 'Copperplate', 'Futura', 'Gill Sans',
            'Optima', 'Segoe UI', 'Menlo', 'Monaco', 'SF Pro',
        ];

        var baseFonts = ['monospace', 'sans-serif', 'serif'];
        var testString = 'mmmmmmmmmmlli';
        var testSize = '72px';
        var body = document.body;

        var span = document.createElement('span');
        span.style.position = 'absolute';
        span.style.left = '-9999px';
        span.style.fontSize = testSize;
        span.style.lineHeight = 'normal';
        span.innerHTML = testString;
        body.appendChild(span);

        var baseSizes = {};
        for (var i = 0; i < baseFonts.length; i++) {
            span.style.fontFamily = baseFonts[i];
            baseSizes[baseFonts[i]] = { width: span.offsetWidth, height: span.offsetHeight };
        }

        var detected = [];
        for (var j = 0; j < testFonts.length; j++) {
            for (var k = 0; k < baseFonts.length; k++) {
                span.style.fontFamily = '"' + testFonts[j] + '",' + baseFonts[k];
                if (span.offsetWidth !== baseSizes[baseFonts[k]].width ||
                    span.offsetHeight !== baseSizes[baseFonts[k]].height) {
                    detected.push(testFonts[j]);
                    break;
                }
            }
        }

        body.removeChild(span);
        return detected;
    }

    // ─── Headless Detection ────────────────────────────────────
    function detectHeadless() {
        // Check for known headless browser indicators
        if (navigator.webdriver) return true;
        if (window._phantom || window.__nightmare) return true;
        if (window.callPhantom || window._phantom) return true;
        if (navigator.languages === '') return true;
        if (navigator.plugins.length === 0 && navigator.userAgent.includes('HeadlessChrome')) return true;

        // Check for missing Chrome features
        if (window.chrome === undefined && navigator.userAgent.includes('Chrome')) return true;

        // Chrome-specific checks
        if (window.chrome) {
            if (!window.chrome.runtime) {
                // Might be headless Chrome
            }
        }

        return false;
    }

    // ─── Automation Detection ──────────────────────────────────
    function detectAutomation() {
        var signs = [];

        // WebDriver
        if (navigator.webdriver !== undefined && navigator.webdriver) signs.push('webdriver');

        // Selenium
        if (document.__selenium_unwrapped || document.__webdriver_evaluate || document.__driver_evaluate) {
            signs.push('selenium');
        }

        // Puppeteer / CDP
        if (window.__puppeteer_evaluation_script__) signs.push('puppeteer');

        // PlayWright  
        if (window.__playwright) signs.push('playwright');

        // PhantomJS
        if (window.callPhantom || window._phantom) signs.push('phantomjs');

        // Nightmare
        if (window.__nightmare) signs.push('nightmare');

        // Check for automation-related properties
        var documentProps = Object.getOwnPropertyNames(document);
        var automationProps = documentProps.filter(function (p) {
            return p.includes('driver') || p.includes('selenium') || p.includes('webdriver');
        });
        if (automationProps.length > 0) signs.push('dom_props');

        return signs.length > 0;
    }

    // ─── Spoofing Detection ────────────────────────────────────
    function detectSpoofing(components) {
        // Check for impossible combinations
        var ua = navigator.userAgent.toLowerCase();
        var platform = (navigator.platform || '').toLowerCase();

        // Platform mismatch
        if (platform.includes('mac') && ua.includes('windows')) return true;
        if (platform.includes('win') && ua.includes('macintosh')) return true;
        if (platform.includes('linux') && ua.includes('macintosh') && !ua.includes('android')) return true;

        // Screen mismatch with device type
        if (ua.includes('mobile') && components.screen && components.screen.width > 2000) return true;

        // Zero hardware concurrency (usually spoofed)
        if (navigator.hardwareConcurrency === 0) return true;

        return false;
    }

    // ─── Plugin Detection ──────────────────────────────────────
    function getPlugins() {
        var plugins = [];
        for (var i = 0; i < navigator.plugins.length && i < 20; i++) {
            plugins.push(navigator.plugins[i].name);
        }
        return plugins;
    }

    // ─── Behavioral Tracking ──────────────────────────────────
    TrialShield.prototype._initBehaviorTracking = function () {
        var self = this;

        // Mouse movement tracking
        document.addEventListener('mousemove', function (e) {
            if (self.mouseEvents.length < 500) {
                self.mouseEvents.push({
                    x: e.clientX,
                    y: e.clientY,
                    t: Date.now()
                });
            }
        });

        // Keystroke timing
        document.addEventListener('keydown', function () {
            if (self.keystrokeTimings.length < 200) {
                self.keystrokeTimings.push(Date.now());
            }
        });

        // Touch events
        document.addEventListener('touchstart', function (e) {
            if (self.touchEvents.length < 100) {
                self.touchEvents.push({
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY,
                    t: Date.now()
                });
            }
        });
    };

    // ─── Get Behavioral Data ──────────────────────────────────
    TrialShield.prototype.getBehavioralData = function () {
        return {
            mouseEntropy: calculateMouseEntropy(this.mouseEvents),
            keystrokeVariance: calculateKeystrokeVariance(this.keystrokeTimings),
            timeOnPage: Date.now() - this.startTime,
            mouseEventCount: this.mouseEvents.length,
            keystrokeCount: this.keystrokeTimings.length,
            touchEventCount: this.touchEvents.length,
        };
    };

    // ─── Mouse Entropy ────────────────────────────────────────
    function calculateMouseEntropy(events) {
        if (events.length < 10) return 0;

        var angles = [];
        for (var i = 2; i < events.length; i++) {
            var dx1 = events[i - 1].x - events[i - 2].x;
            var dy1 = events[i - 1].y - events[i - 2].y;
            var dx2 = events[i].x - events[i - 1].x;
            var dy2 = events[i].y - events[i - 1].y;
            var angle = Math.atan2(dy2, dx2) - Math.atan2(dy1, dx1);
            angles.push(angle);
        }

        // Calculate Shannon entropy of angle distribution
        var bins = {};
        var total = angles.length;
        angles.forEach(function (a) {
            var bin = Math.round(a * 10) / 10;
            bins[bin] = (bins[bin] || 0) + 1;
        });

        var entropy = 0;
        Object.values(bins).forEach(function (count) {
            var p = count / total;
            if (p > 0) entropy -= p * Math.log2(p);
        });

        // Normalize to 0-1
        return Math.min(1, entropy / Math.log2(total));
    }

    // ─── Keystroke Variance ────────────────────────────────────
    function calculateKeystrokeVariance(timings) {
        if (timings.length < 5) return 1;

        var intervals = [];
        for (var i = 1; i < timings.length; i++) {
            intervals.push(timings[i] - timings[i - 1]);
        }

        var mean = intervals.reduce(function (a, b) { return a + b; }, 0) / intervals.length;
        var variance = intervals.reduce(function (sum, val) {
            return sum + Math.pow(val - mean, 2);
        }, 0) / intervals.length;

        // Normalize: high variance = human, low variance = bot
        return Math.min(1, Math.sqrt(variance) / mean);
    }

    // ─── Hash Components ──────────────────────────────────────
    async function hashComponents(components) {
        var str = JSON.stringify({
            canvas: components.canvas,
            webgl: components.webgl,
            audio: components.audio,
            fonts: components.fonts,
            screen: components.screen,
            timezone: components.timezone,
            platform: components.platform,
            language: components.language,
            hardwareConcurrency: components.hardwareConcurrency,
        });

        if (window.crypto && window.crypto.subtle) {
            var buffer = new TextEncoder().encode(str);
            var hash = await window.crypto.subtle.digest('SHA-256', buffer);
            var hashArray = Array.from(new Uint8Array(hash));
            return hashArray.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
        }

        // Fallback simple hash
        return simpleHash(str);
    }

    function simpleHash(str) {
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
            var char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    function generateSessionId() {
        return 'ts_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }

    // ─── Expose TrialShield ────────────────────────────────────
    window.TrialShield = TrialShield;

})(window);
