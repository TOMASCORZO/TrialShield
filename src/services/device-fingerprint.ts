// TrialShield — Device Fingerprint Analysis (Server-Side)
// Processes fingerprints from client SDK, detects spoofing, headless browsers, automation

import { DeviceFingerprint, RiskSignal } from '@/types';
import { supabaseAdmin } from '@/lib/supabase';

// ─── Main Analysis Function ──────────────────────────────────
export async function analyzeDevice(
    fingerprint: DeviceFingerprint,
    userId?: string
): Promise<{ score: number; signals: RiskSignal[]; linkedAccounts: number }> {
    const signals: RiskSignal[] = [];
    let score = 0;

    if (!fingerprint || !fingerprint.id) {
        return {
            score: 30,
            signals: [{
                module: 'DEVICE', signal: 'NO_FINGERPRINT', severity: 'MEDIUM',
                description: 'No device fingerprint provided — client SDK may be blocked',
            }],
            linkedAccounts: 0,
        };
    }

    // 1. Headless Browser Detection
    if (fingerprint.headless) {
        score += 50;
        signals.push({
            module: 'DEVICE', signal: 'HEADLESS_BROWSER', severity: 'CRITICAL',
            description: 'Headless browser detected (Puppeteer, Playwright, PhantomJS)',
        });
    }

    // 2. Automation Detection
    if (fingerprint.automationDetected) {
        score += 45;
        signals.push({
            module: 'DEVICE', signal: 'AUTOMATION_DETECTED', severity: 'CRITICAL',
            description: 'Browser automation framework detected (Selenium, WebDriver)',
        });
    }

    // 3. Spoofing Detection
    if (fingerprint.spoofingDetected) {
        score += 40;
        signals.push({
            module: 'DEVICE', signal: 'SPOOFING_DETECTED', severity: 'CRITICAL',
            description: 'Fingerprint spoofing detected — anti-detect browser likely in use',
        });
    }

    // 4. Impossible Hardware Combinations
    const hwAnomalies = detectHardwareAnomalies(fingerprint);
    if (hwAnomalies.length > 0) {
        score += 20 * hwAnomalies.length;
        hwAnomalies.forEach(anomaly => signals.push(anomaly));
    }

    // 5. Check device graph for linked accounts
    let linkedAccounts = 0;
    try {
        const { data: existingDevices } = await supabaseAdmin
            .from('ts_device_graph')
            .select('user_id')
            .eq('device_fingerprint_id', fingerprint.id);

        if (existingDevices) {
            const uniqueUsers = new Set(existingDevices.map(d => d.user_id));
            linkedAccounts = uniqueUsers.size;

            if (linkedAccounts > 1) {
                score += Math.min(50, linkedAccounts * 15);
                signals.push({
                    module: 'DEVICE', signal: 'MULTI_ACCOUNT_DEVICE', severity: linkedAccounts > 3 ? 'CRITICAL' : 'HIGH',
                    description: `Device linked to ${linkedAccounts} accounts`,
                    value: linkedAccounts,
                });
            }
        }

        // 6. Record device in graph
        if (userId) {
            const { data: existing } = await supabaseAdmin
                .from('ts_device_graph')
                .select('id, times_seen')
                .eq('device_fingerprint_id', fingerprint.id)
                .eq('user_id', userId)
                .single();

            if (existing) {
                await supabaseAdmin
                    .from('ts_device_graph')
                    .update({ last_seen: new Date().toISOString(), times_seen: (existing.times_seen || 0) + 1 })
                    .eq('id', existing.id);
            } else {
                await supabaseAdmin
                    .from('ts_device_graph')
                    .insert({
                        device_fingerprint_id: fingerprint.id,
                        user_id: userId,
                        user_agent: fingerprint.userAgent,
                    });
            }
        }
    } catch (error) {
        console.error('[TrialShield] Device graph error:', error);
    }

    // 7. Missing fingerprint components (SDK tampering)
    const missingComponents = checkMissingComponents(fingerprint);
    if (missingComponents > 3) {
        score += 15;
        signals.push({
            module: 'DEVICE', signal: 'INCOMPLETE_FINGERPRINT', severity: 'MEDIUM',
            description: `${missingComponents} fingerprint components missing — possible SDK tampering`,
            value: missingComponents,
        });
    }

    // 8. Screen resolution anomalies
    if (fingerprint.screen) {
        if (fingerprint.screen.width === 0 || fingerprint.screen.height === 0) {
            score += 20;
            signals.push({
                module: 'DEVICE', signal: 'ZERO_SCREEN', severity: 'HIGH',
                description: 'Screen dimensions are zero — headless environment',
            });
        }
        if (fingerprint.screen.colorDepth < 16) {
            score += 10;
            signals.push({
                module: 'DEVICE', signal: 'LOW_COLOR_DEPTH', severity: 'MEDIUM',
                description: 'Unusually low color depth — virtual or headless display',
            });
        }
    }

    return {
        score: Math.min(100, score),
        signals,
        linkedAccounts,
    };
}

// ─── Hardware Anomaly Detection ──────────────────────────────
function detectHardwareAnomalies(fp: DeviceFingerprint): RiskSignal[] {
    const anomalies: RiskSignal[] = [];

    // Check for impossible hardware combinations
    if (fp.platform && fp.userAgent) {
        const platformLower = fp.platform.toLowerCase();
        const uaLower = fp.userAgent.toLowerCase();

        // Platform says Mac but UA says Windows (or vice versa)
        if (platformLower.includes('mac') && uaLower.includes('windows')) {
            anomalies.push({
                module: 'DEVICE', signal: 'PLATFORM_MISMATCH', severity: 'HIGH',
                description: 'Platform/UserAgent mismatch — possible spoofing',
            });
        }

        // Mobile platform but desktop UA
        if ((platformLower.includes('iphone') || platformLower.includes('android')) &&
            (uaLower.includes('windows nt') || uaLower.includes('macintosh'))) {
            anomalies.push({
                module: 'DEVICE', signal: 'MOBILE_DESKTOP_MISMATCH', severity: 'HIGH',
                description: 'Mobile platform with desktop user agent — spoofing',
            });
        }
    }

    // Impossible hardware specs
    if (fp.hardwareConcurrency && fp.hardwareConcurrency > 128) {
        anomalies.push({
            module: 'DEVICE', signal: 'IMPOSSIBLE_CPU', severity: 'HIGH',
            description: `Impossible CPU core count: ${fp.hardwareConcurrency}`,
        });
    }

    if (fp.deviceMemory && fp.deviceMemory > 256) {
        anomalies.push({
            module: 'DEVICE', signal: 'IMPOSSIBLE_MEMORY', severity: 'HIGH',
            description: `Impossible device memory: ${fp.deviceMemory}GB`,
        });
    }

    return anomalies;
}

// ─── Missing Component Check ─────────────────────────────────
function checkMissingComponents(fp: DeviceFingerprint): number {
    const components = [
        fp.canvas, fp.webgl, fp.audio, fp.fonts, fp.screen,
        fp.timezone, fp.language, fp.platform, fp.plugins,
    ];
    return components.filter(c => c === undefined || c === null).length;
}
