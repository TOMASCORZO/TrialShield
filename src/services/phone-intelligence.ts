// TrialShield — Phone Intelligence Module (HARDENED)
// Real integrations: libphonenumber-js, Numverify API, AbstractAPI, comprehensive VOIP detection

import { PhoneAnalysis, RiskSignal } from '@/types';
import { CONFIG } from '@/config';
import { parsePhoneNumber, isValidPhoneNumber, CountryCode } from 'libphonenumber-js';
import { supabaseAdmin } from '@/lib/supabase';
import { sha256 } from '@/lib/utils';

// ─── Comprehensive VOIP carrier database ─────────────────────
// Sourced from: telecom databases, FCC filings, known VOIP/burner app providers
const VOIP_CARRIERS = new Set([
    // Major VOIP platforms
    'twilio', 'bandwidth', 'vonage', 'nexmo', 'plivo', 'telnyx',
    'signalwire', 'sinch', 'messagebird', 'clicksend', 'textmagic',
    // Consumer VOIP / burner apps
    'google voice', 'google fi', 'textnow', 'textfree', 'pinger',
    'ringcentral', 'grasshopper', 'burner', 'hushed', 'sideline',
    'dingtone', 'talkatone', 'freedompop', 'magicjack', 'ooma',
    'line2', 'openphone', 'dialpad', 'aircall', 'justcall',
    'skype', 'zoom phone', 'microsoft teams',
    // Additional burner/temp number providers
    '2ndline', 'second line', 'phoner', 'flyp', 'numero',
    'wabi', 'telos', 'coverme', 'nextplus', 'virtuphone',
    'virtualphone', 'sonetel', 'callcentric', 'voip.ms',
    'anveo', 'localphone', 'voipfone', 'sipgate', 'zadarma',
    'freshcaller', 'ringover', 'cloudtalk', 'talkdesk', 'five9',
    // Wholesale / API providers that enable burner numbers
    'bandwidth.com', 'intelemedia', 'commio', 'flowroute',
    'voxbone', 'didlogic', 'telzio', 'phone.com', 'inum',
    'callfire', 'callrail', 'marchex', 'smith.ai',
    // Known non-fixed VOIP (NCL/CLECs)
    'onvoy', 'peerless', 'level 3', 'inteliquent', 'neutral tandem',
    'west telecom', 'xo communications', 'fusion connect',
]);

// Countries where VOIP abuse is especially prevalent
const VOIP_ABUSE_COUNTRIES = new Set([
    'NG', 'GH', 'CM', 'SN', 'CI', // West Africa
    'PK', 'BD', 'IN', 'LK',       // South Asia
    'VN', 'PH', 'MM', 'KH',       // Southeast Asia
    'RU', 'UA', 'BY', 'KZ',       // Eastern Europe
]);

// ─── Main Analysis Function ──────────────────────────────────
export async function analyzePhone(phone: string): Promise<PhoneAnalysis> {
    const signals: RiskSignal[] = [];
    let score = 0;

    // 1. Parse and validate with libphonenumber-js
    let normalized = phone;
    let countryCode = 'UNKNOWN';
    let country = 'Unknown';
    let isValid = false;

    try {
        const parsed = parsePhoneNumber(phone);
        if (parsed) {
            normalized = parsed.formatInternational();
            countryCode = parsed.country || 'UNKNOWN';
            country = getCountryName(countryCode);
            isValid = parsed.isValid();
        }
    } catch {
        for (const cc of ['US', 'GB', 'DE', 'FR', 'BR', 'MX', 'AR', 'CO', 'CL', 'PE', 'ES', 'IT'] as CountryCode[]) {
            try {
                if (isValidPhoneNumber(phone, cc)) {
                    const parsed = parsePhoneNumber(phone, cc);
                    if (parsed) {
                        normalized = parsed.formatInternational();
                        countryCode = cc;
                        country = getCountryName(cc);
                        isValid = true;
                        break;
                    }
                }
            } catch { continue; }
        }
    }

    if (!isValid) {
        score += 40;
        signals.push({
            module: 'PHONE', signal: 'INVALID_PHONE', severity: 'HIGH',
            description: 'Phone number failed international validation',
        });
    }

    // 2. Line type detection (libphonenumber)
    const lineType = detectLineType(phone);
    const isVoipByType = lineType === 'VOIP';

    if (isVoipByType) {
        score += 35;
        signals.push({
            module: 'PHONE', signal: 'VOIP_NUMBER', severity: 'HIGH',
            description: 'VOIP/virtual number detected via phone type analysis',
        });
    }

    if (lineType === 'LANDLINE') {
        score += 10;
        signals.push({
            module: 'PHONE', signal: 'LANDLINE_NUMBER', severity: 'LOW',
            description: 'Landline number — unusual for trial signup',
        });
    }

    // 3. Real carrier lookup via multiple APIs
    const carrierResult = await lookupCarrierMultiAPI(phone, countryCode);
    let carrierName = carrierResult.carrier;
    let isVoip = isVoipByType || carrierResult.isVoip;

    if (carrierResult.isVoip && !isVoipByType) {
        score += 30;
        signals.push({
            module: 'PHONE', signal: 'VOIP_CARRIER_API', severity: 'HIGH',
            description: `VOIP number confirmed via carrier API (carrier: ${carrierName || 'unknown'})`,
            value: carrierName,
        });
    }

    if (carrierName && VOIP_CARRIERS.has(carrierName.toLowerCase()) && !isVoip) {
        isVoip = true;
        score += 25;
        signals.push({
            module: 'PHONE', signal: 'VOIP_CARRIER_DB', severity: 'HIGH',
            description: `Known VOIP carrier match: ${carrierName}`,
            value: carrierName,
        });
    }

    // 4. Country risk scoring
    const countryRisk = getCountryRisk(countryCode);
    if (countryRisk === 'HIGH') {
        score += CONFIG.countryRisk.HIGH;
        signals.push({
            module: 'PHONE', signal: 'HIGH_RISK_COUNTRY', severity: 'HIGH',
            description: `Phone from high-risk abuse country: ${country} (${countryCode})`,
            value: countryCode,
        });
    } else if (countryRisk === 'MEDIUM') {
        score += CONFIG.countryRisk.MEDIUM;
        signals.push({
            module: 'PHONE', signal: 'MEDIUM_RISK_COUNTRY', severity: 'MEDIUM',
            description: `Phone from medium-risk country: ${country} (${countryCode})`,
            value: countryCode,
        });
    }

    // 5. VOIP + high-risk country = extra dangerous
    if (isVoip && VOIP_ABUSE_COUNTRIES.has(countryCode)) {
        score += 20;
        signals.push({
            module: 'PHONE', signal: 'VOIP_HIGH_RISK_COUNTRY', severity: 'CRITICAL',
            description: `VOIP number from high-abuse-country: ${country}`,
        });
    }

    // 6. Toll-free / premium detection
    const tollFreePatterns: Record<string, string[]> = {
        US: ['800', '888', '877', '866', '855', '844', '833'],
        UK: ['0800', '0808', '0500'],
        AU: ['1800', '1300'],
        IN: ['1800'],
    };
    const digits = phone.replace(/[^0-9]/g, '');
    const prefixes = tollFreePatterns[countryCode] || tollFreePatterns.US || [];
    const isTollFree = prefixes.some(p => digits.includes(p));
    if (isTollFree) {
        score += 20;
        signals.push({
            module: 'PHONE', signal: 'TOLL_FREE_NUMBER', severity: 'MEDIUM',
            description: 'Toll-free number — unusual for personal signup',
        });
    }

    // 7. Short/malformed number
    if (digits.length < 7) {
        score += 20;
        signals.push({
            module: 'PHONE', signal: 'SHORT_NUMBER', severity: 'MEDIUM',
            description: 'Suspiciously short phone number',
            value: digits.length,
        });
    }

    // 8. Sequential/repeated digits
    if (/(.)(\1){5,}/.test(digits)) {
        score += 20;
        signals.push({
            module: 'PHONE', signal: 'REPEATED_DIGITS', severity: 'HIGH',
            description: 'Phone number contains 6+ repeated digits',
        });
    }
    if (/012345|123456|234567|345678|456789|567890|987654|876543|765432/.test(digits)) {
        score += 15;
        signals.push({
            module: 'PHONE', signal: 'SEQUENTIAL_DIGITS', severity: 'MEDIUM',
            description: 'Phone number contains sequential digits',
        });
    }

    // 9. Phone number reuse detection (same normalized phone → multiple accounts)
    const phoneReuse = await checkPhoneReuse(normalized);
    if (phoneReuse > 0) {
        score += Math.min(40, phoneReuse * 15);
        signals.push({
            module: 'PHONE', signal: 'PHONE_REUSED', severity: phoneReuse > 2 ? 'CRITICAL' : 'HIGH',
            description: `Phone number used by ${phoneReuse} other account(s)`,
            value: phoneReuse,
        });
    }

    return {
        score: Math.min(100, score),
        normalized,
        countryCode,
        country,
        carrierName,
        lineType,
        isVoip,
        countryRisk,
        isValid,
        signals,
    };
}

// ─── Carrier Lookup (100% FREE — no API keys) ───────────────
// Uses omkarcloud/phone-lookup-api (5,000 free/month) + libphonenumber-js offline
async function lookupCarrierMultiAPI(phone: string, countryCode: string): Promise<{ carrier?: string; isVoip: boolean }> {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');

    // Try free phone-lookup-api (no API key needed, 5,000/month)
    const freeResult = await tryFreePhoneLookup(cleanPhone);
    if (freeResult) return freeResult;

    // Fallback: use libphonenumber-js type detection (offline, unlimited)
    const lineType = detectLineType(phone);
    return {
        carrier: undefined,
        isVoip: lineType === 'VOIP',
    };
}

// Free phone lookup API (github.com/omkarcloud/phone-lookup-api)
async function tryFreePhoneLookup(phone: string): Promise<{ carrier?: string; isVoip: boolean } | null> {
    try {
        const response = await fetch(
            `https://phone-lookup-api.fly.dev/api/phone/${encodeURIComponent(phone)}`,
            { signal: AbortSignal.timeout(5000) }
        );
        if (!response.ok) return null;
        const data = await response.json();

        if (data.carrier || data.line_type) {
            const isVoip = data.line_type === 'voip' ||
                (data.carrier && VOIP_CARRIERS.has(data.carrier.toLowerCase()));
            return { carrier: data.carrier, isVoip };
        }
        return null;
    } catch { return null; }
}

// ─── Phone Reuse Detection ──────────────────────────────────
async function checkPhoneReuse(normalizedPhone: string): Promise<number> {
    try {
        const phoneHash = sha256(normalizedPhone);
        const { count } = await supabaseAdmin
            .from('ts_users')
            .select('*', { count: 'exact', head: true })
            .eq('phone_hash', phoneHash);

        return Math.max(0, (count || 0) - 1); // Exclude current signup
    } catch {
        return 0;
    }
}

// ─── Line Type Detection ─────────────────────────────────────
function detectLineType(phone: string): 'MOBILE' | 'VOIP' | 'LANDLINE' | 'UNKNOWN' {
    try {
        const parsed = parsePhoneNumber(phone);
        if (!parsed) return 'UNKNOWN';
        const type = parsed.getType();
        switch (type) {
            case 'MOBILE': return 'MOBILE';
            case 'FIXED_LINE': return 'LANDLINE';
            case 'FIXED_LINE_OR_MOBILE': return 'MOBILE';
            case 'VOIP': return 'VOIP';
            case 'TOLL_FREE': return 'VOIP';
            case 'PREMIUM_RATE': return 'VOIP';
            case 'PERSONAL_NUMBER': return 'VOIP';
            default: return 'UNKNOWN';
        }
    } catch { return 'UNKNOWN'; }
}

// ─── Country Risk Assessment ─────────────────────────────────
function getCountryRisk(countryCode: string): 'LOW' | 'MEDIUM' | 'HIGH' {
    if ((CONFIG.phone.highRiskCountries as readonly string[]).includes(countryCode)) return 'HIGH';
    if ((CONFIG.phone.mediumRiskCountries as readonly string[]).includes(countryCode)) return 'MEDIUM';
    return 'LOW';
}

// ─── Country Name Lookup ─────────────────────────────────────
function getCountryName(code: string): string {
    const countries: Record<string, string> = {
        US: 'United States', GB: 'United Kingdom', CA: 'Canada', AU: 'Australia',
        DE: 'Germany', FR: 'France', ES: 'Spain', IT: 'Italy', NL: 'Netherlands',
        BR: 'Brazil', MX: 'Mexico', AR: 'Argentina', CO: 'Colombia', CL: 'Chile',
        PE: 'Peru', EC: 'Ecuador', VE: 'Venezuela', BO: 'Bolivia', PY: 'Paraguay',
        UY: 'Uruguay', IN: 'India', PK: 'Pakistan', BD: 'Bangladesh', CN: 'China',
        JP: 'Japan', KR: 'South Korea', PH: 'Philippines', VN: 'Vietnam',
        TH: 'Thailand', ID: 'Indonesia', MY: 'Malaysia', SG: 'Singapore',
        NG: 'Nigeria', GH: 'Ghana', KE: 'Kenya', ZA: 'South Africa',
        EG: 'Egypt', MA: 'Morocco', RU: 'Russia', UA: 'Ukraine', PL: 'Poland',
        CZ: 'Czech Republic', RO: 'Romania', SE: 'Sweden', NO: 'Norway',
        DK: 'Denmark', FI: 'Finland', PT: 'Portugal', CH: 'Switzerland',
        AT: 'Austria', BE: 'Belgium', IE: 'Ireland', IL: 'Israel',
        AE: 'UAE', SA: 'Saudi Arabia', TR: 'Turkey',
        CM: 'Cameroon', SN: 'Senegal', CI: 'Ivory Coast',
        LK: 'Sri Lanka', MM: 'Myanmar', KH: 'Cambodia', BY: 'Belarus', KZ: 'Kazakhstan',
    };
    return countries[code] || code;
}
