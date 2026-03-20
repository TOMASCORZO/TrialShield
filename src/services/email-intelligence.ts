// TrialShield — Email Intelligence Module (HARDENED)
// Real integrations: DNS MX + SMTP probe + HaveIBeenPwned + disposable detection + email normalization dedup

import { EmailAnalysis, RiskSignal } from '@/types';
import { isDefinitelyDisposable, isFreeEmailProvider, isSuspiciousTLD } from '@/data/disposable-domains';
import { CONFIG } from '@/config';
import { normalizeEmail, sha256 } from '@/lib/utils';
import { supabaseAdmin } from '@/lib/supabase';
import dns from 'dns';
import net from 'net';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);
const resolveNs = promisify(dns.resolveNs);

// ─── Main Analysis Function ──────────────────────────────────
export async function analyzeEmail(email: string): Promise<EmailAnalysis> {
    const signals: RiskSignal[] = [];
    let score = 0;

    const normalized = normalizeEmail(email);
    const [localPart, domain] = email.toLowerCase().trim().split('@');

    if (!localPart || !domain) {
        return {
            score: 100, normalized: email,
            isDisposable: false, isCatchAll: false, isRoleBased: false,
            hasMxRecords: false, isBreached: false, aliasDetected: false,
            dotTrickDetected: false,
            signals: [{ module: 'EMAIL', signal: 'INVALID_FORMAT', severity: 'CRITICAL', description: 'Invalid email format' }],
        };
    }

    // 1. Disposable email check (3,500+ domains + wildcard matching)
    const isDisposable = isDefinitelyDisposable(domain);
    if (isDisposable) {
        score += 80;
        signals.push({
            module: 'EMAIL', signal: 'DISPOSABLE_EMAIL', severity: 'CRITICAL',
            description: `Disposable email domain detected: ${domain}`,
            value: domain,
        });
    }

    // 2. Free email provider tracking (not punished, but tracked for bulk abuse)
    const isFreeProvider = isFreeEmailProvider(domain);
    if (isFreeProvider) {
        // Check if this free provider is being used in bulk from same IP/device
        // (score bump happens in behavioral analysis, here we just flag)
        signals.push({
            module: 'EMAIL', signal: 'FREE_PROVIDER', severity: 'LOW',
            description: `Free email provider: ${domain}`,
            value: domain,
        });
    }

    // 3. Suspicious TLD check (high-abuse TLDs like .tk, .ml, .xyz)
    if (isSuspiciousTLD(domain)) {
        score += 25;
        signals.push({
            module: 'EMAIL', signal: 'SUSPICIOUS_TLD', severity: 'HIGH',
            description: `Domain uses high-abuse TLD commonly associated with disposable services`,
            value: '.' + domain.split('.').pop(),
        });
    }

    // 4. Role-based email check
    const isRoleBased = (CONFIG.email.roleBasedPrefixes as readonly string[]).includes(localPart);
    if (isRoleBased) {
        score += 15;
        signals.push({
            module: 'EMAIL', signal: 'ROLE_BASED_EMAIL', severity: 'MEDIUM',
            description: `Role-based email prefix: ${localPart}`,
            value: localPart,
        });
    }

    // 5. Alias detection (+tag)
    const aliasDetected = email.includes('+');
    if (aliasDetected) {
        score += 10;
        signals.push({
            module: 'EMAIL', signal: 'ALIAS_DETECTED', severity: 'LOW',
            description: 'Email contains +alias tag (potential multi-account)',
            value: email.split('+')[1]?.split('@')[0],
        });
    }

    // 6. Gmail dot trick detection
    const isGmail = (CONFIG.email.gmailDomains as readonly string[]).includes(domain);
    const dotTrickDetected = isGmail && localPart.includes('.') && localPart !== normalized.split('@')[0];
    if (dotTrickDetected) {
        score += 5;
        signals.push({
            module: 'EMAIL', signal: 'DOT_TRICK', severity: 'LOW',
            description: 'Gmail dot trick detected (dots in username)',
        });
    }

    // 7. MX Records check (real DNS lookup)
    let hasMxRecords = false;
    let mxProvider: string | undefined;
    try {
        const mxRecords = await resolveMx(domain);
        hasMxRecords = mxRecords.length > 0;
        if (hasMxRecords) {
            mxProvider = mxRecords.sort((a, b) => a.priority - b.priority)[0]?.exchange;
        }
    } catch {
        hasMxRecords = false;
    }

    if (!hasMxRecords) {
        score += 35;
        signals.push({
            module: 'EMAIL', signal: 'NO_MX_RECORDS', severity: 'HIGH',
            description: 'Domain has no MX records (cannot receive email)',
        });
    }

    // 8. SPF / DMARC check (email legitimacy indicators)
    const domainAuth = await checkDomainAuthentication(domain);
    if (!domainAuth.hasSpf && !domainAuth.hasDmarc && !isFreeProvider) {
        score += 10;
        signals.push({
            module: 'EMAIL', signal: 'NO_EMAIL_AUTH', severity: 'MEDIUM',
            description: 'Domain lacks SPF/DMARC records — likely not a real business',
        });
    }

    // 9. Catch-all detection (SMTP RCPT TO probe)
    const isCatchAll = await detectCatchAll(domain, mxProvider);
    if (isCatchAll) {
        score += 10;
        signals.push({
            module: 'EMAIL', signal: 'CATCH_ALL_DOMAIN', severity: 'MEDIUM',
            description: 'Domain accepts all email addresses (catch-all)',
        });
    }

    // 10. HaveIBeenPwned breach check (real API)
    let isBreached = false;
    let breachCount = 0;
    if (CONFIG.features.enableBreachCheck) {
        const breachResult = await checkBreaches(email);
        isBreached = breachResult.breached;
        breachCount = breachResult.count;
        if (isBreached) {
            score += 15;
            signals.push({
                module: 'EMAIL', signal: 'BREACHED_EMAIL', severity: 'HIGH',
                description: `Email found in ${breachCount} data breach(es)`,
                value: breachCount,
            });
        }
    }

    // 11. Normalized email deduplication (find other accounts with same base email)
    const normalizedDupes = await checkNormalizedDuplicates(normalized);
    if (normalizedDupes > 0) {
        score += Math.min(40, normalizedDupes * 12);
        signals.push({
            module: 'EMAIL', signal: 'NORMALIZED_DUPLICATE', severity: normalizedDupes > 2 ? 'CRITICAL' : 'HIGH',
            description: `${normalizedDupes} other account(s) share the same normalized email (dot/alias tricks)`,
            value: normalizedDupes,
        });
    }

    // 12. Domain age heuristic (newly registered domains = higher risk)
    const domainAge = await estimateDomainAge(domain);
    if (domainAge === 'NEW') {
        score += 20;
        signals.push({
            module: 'EMAIL', signal: 'NEW_DOMAIN', severity: 'HIGH',
            description: 'Email domain appears recently registered',
        });
    }

    // 13. Suspicious patterns — randomized username detection
    const randomScore = analyzeLocalPartRandomness(localPart);
    if (randomScore > 0.7) {
        score += 15;
        signals.push({
            module: 'EMAIL', signal: 'RANDOM_PATTERN', severity: 'MEDIUM',
            description: 'Email local part appears randomly generated',
            value: Math.round(randomScore * 100),
        });
    }

    // 14. Numeric patterns (auto-gen)
    if (/\d{5,}/.test(localPart)) {
        score += 10;
        signals.push({
            module: 'EMAIL', signal: 'NUMERIC_PATTERN', severity: 'MEDIUM',
            description: 'Email contains long numeric sequence (auto-generated pattern)',
        });
    }

    // 15. Very long local part
    if (localPart.length > 30) {
        score += 5;
        signals.push({
            module: 'EMAIL', signal: 'LONG_LOCAL_PART', severity: 'LOW',
            description: 'Unusually long email local part',
            value: localPart.length,
        });
    }

    return {
        score: Math.min(100, score),
        normalized,
        isDisposable,
        isCatchAll,
        isRoleBased,
        hasMxRecords,
        mxProvider,
        isBreached,
        breachCount,
        aliasDetected,
        dotTrickDetected,
        signals,
    };
}

// ─── XposedOrNot Breach Check (FREE — no API key needed) ─────
// Docs: https://xposedornot.com/api_doc
async function checkBreaches(email: string): Promise<{ breached: boolean; count: number }> {
    try {
        const response = await fetch(
            `https://api.xposedornot.com/v1/check-email/${encodeURIComponent(email)}`,
            {
                headers: { 'User-Agent': 'TrialShield-API' },
                signal: AbortSignal.timeout(5000),
            }
        );

        if (response.status === 404) return { breached: false, count: 0 };

        if (response.ok) {
            const data = await response.json();
            // XposedOrNot returns breaches array in ExposedBreaches.breaches_details
            if (data.ExposedBreaches?.breaches_details) {
                const breaches = data.ExposedBreaches.breaches_details;
                const count = Array.isArray(breaches) ? breaches.length : 0;
                return { breached: count > 0, count };
            }
            return { breached: false, count: 0 };
        }

        // Rate limited (1 req/sec) — wait and retry once
        if (response.status === 429) {
            await new Promise(r => setTimeout(r, 1200));
            const retry = await fetch(
                `https://api.xposedornot.com/v1/check-email/${encodeURIComponent(email)}`,
                { headers: { 'User-Agent': 'TrialShield-API' }, signal: AbortSignal.timeout(5000) }
            );
            if (retry.ok) {
                const data = await retry.json();
                const breaches = data.ExposedBreaches?.breaches_details;
                const count = Array.isArray(breaches) ? breaches.length : 0;
                return { breached: count > 0, count };
            }
        }

        return { breached: false, count: 0 };
    } catch (error) {
        console.error('[TrialShield] XposedOrNot breach check failed:', error);
        return { breached: false, count: 0 };
    }
}

// ─── SMTP Catch-All Detection (RCPT TO probe) ───────────────
async function detectCatchAll(domain: string, mxHost?: string): Promise<boolean> {
    if (!mxHost) {
        try {
            const mxRecords = await resolveMx(domain);
            if (!mxRecords.length) return false;
            mxHost = mxRecords.sort((a, b) => a.priority - b.priority)[0]?.exchange;
        } catch { return false; }
    }
    if (!mxHost) return false;

    return new Promise((resolve) => {
        const timeout = setTimeout(() => { resolve(false); }, 5000);
        try {
            const client = net.createConnection(25, mxHost!, () => {
                let buffer = '';
                client.on('data', (data) => {
                    buffer += data.toString();
                    // After SMTP banner, send EHLO
                    if (buffer.includes('220') && !buffer.includes('EHLO sent')) {
                        client.write(`EHLO trialshield.check\r\n`);
                        buffer += 'EHLO sent';
                    }
                    // After EHLO response, send MAIL FROM
                    if (buffer.includes('250') && buffer.includes('EHLO sent') && !buffer.includes('MAIL sent')) {
                        client.write(`MAIL FROM:<check@trialshield.com>\r\n`);
                        buffer += 'MAIL sent';
                    }
                    // After MAIL FROM, send random RCPT TO
                    if (buffer.includes('250') && buffer.includes('MAIL sent') && !buffer.includes('RCPT sent')) {
                        const randomUser = `ts_catchall_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                        client.write(`RCPT TO:<${randomUser}@${domain}>\r\n`);
                        buffer += 'RCPT sent';
                    }
                    // Check RCPT response
                    if (buffer.includes('RCPT sent')) {
                        if (buffer.includes('250') && buffer.match(/250.*RCPT|250.*OK/i)) {
                            // Server accepted a random address = catch-all
                            client.write('QUIT\r\n');
                            clearTimeout(timeout);
                            client.destroy();
                            resolve(true);
                        }
                        if (buffer.includes('550') || buffer.includes('553') || buffer.includes('511') || buffer.includes('552')) {
                            // Server rejected = NOT catch-all
                            client.write('QUIT\r\n');
                            clearTimeout(timeout);
                            client.destroy();
                            resolve(false);
                        }
                    }
                });
                client.on('error', () => { clearTimeout(timeout); resolve(false); });
            });
            client.on('error', () => { clearTimeout(timeout); resolve(false); });
        } catch {
            clearTimeout(timeout);
            resolve(false);
        }
    });
}

// ─── SPF/DMARC Check ────────────────────────────────────────
async function checkDomainAuthentication(domain: string): Promise<{ hasSpf: boolean; hasDmarc: boolean }> {
    let hasSpf = false;
    let hasDmarc = false;

    try {
        const txtRecords = await resolveTxt(domain);
        hasSpf = txtRecords.some(r => r.join('').toLowerCase().startsWith('v=spf1'));
    } catch { }

    try {
        const dmarcRecords = await resolveTxt(`_dmarc.${domain}`);
        hasDmarc = dmarcRecords.some(r => r.join('').toLowerCase().startsWith('v=dmarc1'));
    } catch { }

    return { hasSpf, hasDmarc };
}

// ─── Normalized Email Deduplication ──────────────────────────
// Finds other accounts that share the same normalized email (dot tricks, aliases)
async function checkNormalizedDuplicates(normalizedEmail: string): Promise<number> {
    try {
        const normalizedHash = sha256(normalizedEmail);
        const { count } = await supabaseAdmin
            .from('ts_users')
            .select('*', { count: 'exact', head: true })
            .eq('normalized_email_hash', normalizedHash);

        return (count || 0);
    } catch {
        return 0;
    }
}

// ─── Domain Age Estimation ───────────────────────────────────
// Uses RDAP/DNS heuristics to estimate if domain is new
async function estimateDomainAge(domain: string): Promise<'NEW' | 'ESTABLISHED' | 'UNKNOWN'> {
    try {
        // Check if domain has NS records (basic existence)
        const nsRecords = await resolveNs(domain);
        if (!nsRecords || nsRecords.length === 0) return 'NEW';

        // Check for DNSSEC (established domains often have it)
        // Also check SOA serial number pattern
        try {
            const rdapResponse = await fetch(`https://rdap.org/domain/${domain}`, {
                signal: AbortSignal.timeout(3000),
            });
            if (rdapResponse.ok) {
                const rdap = await rdapResponse.json();
                const events = rdap.events || [];
                const registration = events.find((e: any) => e.eventAction === 'registration');
                if (registration?.eventDate) {
                    const regDate = new Date(registration.eventDate);
                    const daysSinceReg = (Date.now() - regDate.getTime()) / (1000 * 60 * 60 * 24);
                    if (daysSinceReg < 30) return 'NEW';
                    return 'ESTABLISHED';
                }
            }
        } catch { }

        return 'UNKNOWN';
    } catch {
        return 'UNKNOWN';
    }
}

// ─── Randomness Detection ────────────────────────────────────
// Uses entropy calculation + consonant ratio to detect randomly generated usernames
function analyzeLocalPartRandomness(localPart: string): number {
    if (localPart.length < 5) return 0;

    // Clean up separation chars
    const clean = localPart.replace(/[._+-]/g, '');
    if (clean.length < 4) return 0;

    // Consonant ratio (high consonant = likely random)
    const consonants = clean.replace(/[aeiou0-9]/gi, '').length;
    const consonantRatio = consonants / clean.length;

    // Character entropy (Shannon)
    const freq: Record<string, number> = {};
    for (const c of clean) {
        freq[c] = (freq[c] || 0) + 1;
    }
    let entropy = 0;
    for (const count of Object.values(freq)) {
        const p = count / clean.length;
        if (p > 0) entropy -= p * Math.log2(p);
    }
    const normalizedEntropy = entropy / Math.log2(clean.length);

    // Bigram frequency (common bigrams in names vs random)
    const commonBigrams = new Set(['th', 'he', 'in', 'er', 'an', 'on', 'de', 'ar', 'al', 'en', 'is', 'to', 'it', 'or']);
    let bigramHits = 0;
    for (let i = 0; i < clean.length - 1; i++) {
        if (commonBigrams.has(clean.substring(i, i + 2).toLowerCase())) {
            bigramHits++;
        }
    }
    const bigramRatio = bigramHits / Math.max(1, clean.length - 1);

    // Combine signals: high consonant + high entropy + low bigrams = random
    const randomScore = (consonantRatio * 0.4 + normalizedEntropy * 0.3 + (1 - bigramRatio) * 0.3);

    return randomScore;
}
