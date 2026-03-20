
import CryptoJS from 'crypto-js';

// ─── Hashing ──────────────────────────────────────────────────
export function sha256(input: string): string {
    return CryptoJS.SHA256(input.toLowerCase().trim()).toString(CryptoJS.enc.Hex);
}

export function hmacSha256(input: string, key: string): string {
    return CryptoJS.HmacSHA256(input, key).toString(CryptoJS.enc.Hex);
}

// ─── API Key ──────────────────────────────────────────────────
export function generateApiKey(): string {
    const randomWords = CryptoJS.lib.WordArray.random(32);
    return `ts_${randomWords.toString(CryptoJS.enc.Hex)}`;
}

export function hashApiKey(key: string): string {
    return sha256(key);
}

// ─── UUID ─────────────────────────────────────────────────────
export function generateId(): string {
    return crypto.randomUUID();
}

// ─── IP ───────────────────────────────────────────────────────
export function isValidIpv4(ip: string): boolean {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255 && part === num.toString();
    });
}

export function isPrivateIp(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 127.0.0.0/8
    if (parts[0] === 127) return true;
    return false;
}

// ─── Distance ─────────────────────────────────────────────────
export function haversineDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
): number {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
    return deg * (Math.PI / 180);
}

// ─── Time ─────────────────────────────────────────────────────
export function minutesAgo(minutes: number): Date {
    return new Date(Date.now() - minutes * 60 * 1000);
}

export function hoursAgo(hours: number): Date {
    return new Date(Date.now() - hours * 60 * 60 * 1000);
}

export function daysAgo(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// ─── Normalization ────────────────────────────────────────────
export function normalizeEmail(email: string): string {
    const [localPart, domain] = email.toLowerCase().trim().split('@');
    if (!localPart || !domain) return email.toLowerCase().trim();

    let normalized = localPart;

    // Gmail dot trick: remove dots
    if (domain === 'gmail.com' || domain === 'googlemail.com') {
        normalized = normalized.replace(/\./g, '');
    }

    // Remove +alias for all providers
    const plusIndex = normalized.indexOf('+');
    if (plusIndex !== -1) {
        normalized = normalized.substring(0, plusIndex);
    }

    // Normalize googlemail.com to gmail.com
    const normalizedDomain = domain === 'googlemail.com' ? 'gmail.com' : domain;

    return `${normalized}@${normalizedDomain}`;
}
