// TrialShield — Behavioral & Session Analysis Module
// Velocity checks, bot detection, session anomaly analysis

import { BehaviorAnalysis, RiskSignal, VelocityFlag } from '@/types';
import { CONFIG } from '@/config';
import { supabaseAdmin } from '@/lib/supabase';
import { sha256, minutesAgo, hoursAgo } from '@/lib/utils';

// ─── Main Analysis Function ──────────────────────────────────
export async function analyzeBehavior(
    ip: string,
    email?: string,
    deviceId?: string,
    sessionData?: { mouseEntropy?: number; keystrokePattern?: number; timeOnPage?: number }
): Promise<BehaviorAnalysis> {
    const signals: RiskSignal[] = [];
    let score = 0;
    const velocityFlags: VelocityFlag[] = [];

    // 1. Signup velocity by IP
    const ipSignups = await getVelocityCount('ip', sha256(ip), 'signup', 60);
    const ipVelocity: VelocityFlag = {
        type: 'signup', window: '1 hour', count: ipSignups,
        threshold: CONFIG.velocity.signupsPerIpPerHour,
        exceeded: ipSignups >= CONFIG.velocity.signupsPerIpPerHour,
    };
    velocityFlags.push(ipVelocity);

    if (ipVelocity.exceeded) {
        score += 30;
        signals.push({
            module: 'BEHAVIOR', signal: 'HIGH_SIGNUP_VELOCITY_IP', severity: 'HIGH',
            description: `${ipSignups} signups from this IP in the last hour (limit: ${CONFIG.velocity.signupsPerIpPerHour})`,
            value: ipSignups,
        });
    }

    // 2. Signup velocity by device
    if (deviceId) {
        const deviceSignups = await getVelocityCount('device', deviceId, 'signup', 1440);
        const deviceVelocity: VelocityFlag = {
            type: 'signup', window: '24 hours', count: deviceSignups,
            threshold: CONFIG.velocity.signupsPerDevicePerDay,
            exceeded: deviceSignups >= CONFIG.velocity.signupsPerDevicePerDay,
        };
        velocityFlags.push(deviceVelocity);

        if (deviceVelocity.exceeded) {
            score += 35;
            signals.push({
                module: 'BEHAVIOR', signal: 'HIGH_SIGNUP_VELOCITY_DEVICE', severity: 'CRITICAL',
                description: `${deviceSignups} signups from this device in 24h (limit: ${CONFIG.velocity.signupsPerDevicePerDay})`,
                value: deviceSignups,
            });
        }
    }

    // 3. Signup velocity by email domain
    if (email) {
        const domain = email.split('@')[1];
        if (domain) {
            const domainSignups = await getVelocityCount('email_domain', sha256(domain), 'signup', 60);
            const domainVelocity: VelocityFlag = {
                type: 'signup', window: '1 hour', count: domainSignups,
                threshold: CONFIG.velocity.signupsPerEmailDomainPerHour,
                exceeded: domainSignups >= CONFIG.velocity.signupsPerEmailDomainPerHour,
            };
            velocityFlags.push(domainVelocity);

            if (domainVelocity.exceeded) {
                score += 25;
                signals.push({
                    module: 'BEHAVIOR', signal: 'HIGH_SIGNUP_VELOCITY_DOMAIN', severity: 'HIGH',
                    description: `${domainSignups} signups from domain ${domain} in 1h (limit: ${CONFIG.velocity.signupsPerEmailDomainPerHour})`,
                    value: domainSignups,
                });
            }
        }
    }

    // 4. Bot score analysis
    let botScore = 0;

    if (sessionData) {
        // Mouse entropy analysis (low entropy = bot)
        if (sessionData.mouseEntropy !== undefined && sessionData.mouseEntropy < 0.3) {
            botScore += 40;
            signals.push({
                module: 'BEHAVIOR', signal: 'LOW_MOUSE_ENTROPY', severity: 'HIGH',
                description: 'Mouse movement has low entropy — bot-like behavior',
                value: sessionData.mouseEntropy,
            });
        }

        // Keystroke pattern (too consistent = bot)
        if (sessionData.keystrokePattern !== undefined && sessionData.keystrokePattern < 0.1) {
            botScore += 30;
            signals.push({
                module: 'BEHAVIOR', signal: 'UNIFORM_KEYSTROKES', severity: 'HIGH',
                description: 'Keystroke timing is too uniform — automated input',
                value: sessionData.keystrokePattern,
            });
        }

        // Time on page (too fast = bot)
        if (sessionData.timeOnPage !== undefined && sessionData.timeOnPage < 3000) {
            botScore += 25;
            signals.push({
                module: 'BEHAVIOR', signal: 'RAPID_FORM_FILL', severity: 'MEDIUM',
                description: `Form completed in ${sessionData.timeOnPage}ms — suspiciously fast`,
                value: sessionData.timeOnPage,
            });
        }
    } else {
        // No session data at all is somewhat suspicious
        botScore += 10;
        signals.push({
            module: 'BEHAVIOR', signal: 'NO_SESSION_DATA', severity: 'LOW',
            description: 'No behavioral session data — SDK may be blocked or bypassed',
        });
    }

    score += Math.min(50, botScore * 0.5);

    // 5. Record velocity event
    if (ip) {
        await recordVelocityEvent('ip', sha256(ip), 'signup');
    }
    if (deviceId) {
        await recordVelocityEvent('device', deviceId, 'signup');
    }
    if (email) {
        const domain = email.split('@')[1];
        if (domain) {
            await recordVelocityEvent('email_domain', sha256(domain), 'signup');
        }
    }

    return {
        score: Math.min(100, score),
        velocityFlags,
        botScore: Math.min(100, botScore),
        sessionAnomaly: botScore > 50,
        signals,
    };
}

// ─── Velocity Tracking ───────────────────────────────────────
async function getVelocityCount(
    identifierType: string,
    identifierValue: string,
    eventType: string,
    windowMinutes: number
): Promise<number> {
    try {
        const since = minutesAgo(windowMinutes).toISOString();
        const { count } = await supabaseAdmin
            .from('ts_velocity')
            .select('*', { count: 'exact', head: true })
            .eq('identifier_type', identifierType)
            .eq('identifier_value', identifierValue)
            .eq('event_type', eventType)
            .gte('created_at', since);

        return count || 0;
    } catch {
        return 0;
    }
}

async function recordVelocityEvent(
    identifierType: string,
    identifierValue: string,
    eventType: string
): Promise<void> {
    try {
        await supabaseAdmin
            .from('ts_velocity')
            .insert({
                identifier_type: identifierType,
                identifier_value: identifierValue,
                event_type: eventType,
            });
    } catch (error) {
        console.error('[TrialShield] Failed to record velocity event:', error);
    }
}
