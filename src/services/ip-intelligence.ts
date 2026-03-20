// TrialShield — IP & Network Intelligence Module (HARDENED)
// Real integrations: ip-api.com, AbuseIPDB, TOR exit nodes, datacenter ASN DB, ipapi.is

import { IPAnalysis, RiskSignal, GeoData, ASNData } from '@/types';
import { CONFIG } from '@/config';
import { isPrivateIp, haversineDistance, isValidIpv4 } from '@/lib/utils';
import { isDatacenterASN, isVpnASN, isProxyASN, isHostingByOrgName } from '@/data/datacenter-asns';
import { supabaseAdmin } from '@/lib/supabase';

// Known TOR exit node check endpoint
const TOR_CHECK_URL = 'https://check.torproject.org/torbulkexitlist';

// ─── Main Analysis Function ──────────────────────────────────
export async function analyzeIP(ip: string, userId?: string): Promise<IPAnalysis> {
    const signals: RiskSignal[] = [];
    let score = 0;

    // Skip analysis for private IPs
    if (!ip || isPrivateIp(ip)) {
        return {
            score: 0,
            isVpn: false, isProxy: false, isTor: false,
            isDatacenter: false, isResidentialProxy: false,
            abuseConfidenceScore: 0,
            signals: [{ module: 'IP', signal: 'PRIVATE_IP', severity: 'LOW', description: 'Private/local IP address' }],
        };
    }

    // Run all checks in parallel for speed
    const [geoData, proxyInfo, abuseInfo, isTorNode, ipApiIsData] = await Promise.allSettled([
        getGeoData(ip),
        getProxyDetection(ip),
        checkAbuseIPDB(ip),
        checkTorExitNode(ip),
        checkIpApiIs(ip), // Additional proxy/VPN detection API
    ]);

    // ─── Process geolocation ─────────────────────────────────
    const geo: GeoData = geoData.status === 'fulfilled' ? geoData.value : {} as GeoData;

    // ─── Process proxy/VPN detection ─────────────────────────
    const proxy = proxyInfo.status === 'fulfilled' ? proxyInfo.value : { proxy: false, hosting: false };

    if (proxy.proxy) {
        score += 35;
        signals.push({
            module: 'IP', signal: 'PROXY_DETECTED', severity: 'HIGH',
            description: 'Proxy server detected via ip-api.com',
        });
    }

    if (proxy.hosting) {
        score += 30;
        signals.push({
            module: 'IP', signal: 'HOSTING_IP', severity: 'HIGH',
            description: 'IP belongs to a hosting/datacenter provider',
        });
    }

    // ─── ipapi.is deep VPN/proxy detection ───────────────────
    const ipApiIs = ipApiIsData.status === 'fulfilled' ? ipApiIsData.value : null;
    if (ipApiIs) {
        if (ipApiIs.isVpn && !proxy.proxy) {
            score += 30;
            signals.push({
                module: 'IP', signal: 'VPN_DETECTED', severity: 'HIGH',
                description: `VPN detected via ipapi.is (provider: ${ipApiIs.vpnProvider || 'unknown'})`,
                value: ipApiIs.vpnProvider,
            });
        }
        if (ipApiIs.isCrawler) {
            score += 25;
            signals.push({
                module: 'IP', signal: 'CRAWLER_DETECTED', severity: 'HIGH',
                description: 'Known web crawler/bot IP detected',
            });
        }
    }

    // ─── ASN-based datacenter detection ──────────────────────
    if (geo.as) {
        const asnMatch = geo.as.match(/^AS(\d+)/);
        if (asnMatch) {
            const asnNumber = parseInt(asnMatch[1]);

            if (isDatacenterASN(asnNumber) && !proxy.hosting) {
                score += 25;
                signals.push({
                    module: 'IP', signal: 'DATACENTER_ASN', severity: 'HIGH',
                    description: `IP belongs to datacenter ASN: AS${asnNumber} (${geo.isp || 'unknown'})`,
                    value: asnNumber,
                });
            }

            if (isVpnASN(asnNumber)) {
                score += 35;
                signals.push({
                    module: 'IP', signal: 'VPN_ASN', severity: 'CRITICAL',
                    description: `IP belongs to known VPN provider ASN: AS${asnNumber}`,
                    value: asnNumber,
                });
            }

            if (isProxyASN(asnNumber)) {
                score += 40;
                signals.push({
                    module: 'IP', signal: 'PROXY_ASN', severity: 'CRITICAL',
                    description: `IP belongs to known residential proxy provider ASN: AS${asnNumber}`,
                    value: asnNumber,
                });
            }
        }
    }

    // ─── Org name-based hosting detection ────────────────────
    if (geo.org && isHostingByOrgName(geo.org) && !proxy.hosting) {
        score += 15;
        signals.push({
            module: 'IP', signal: 'HOSTING_ORG', severity: 'MEDIUM',
            description: `ISP/Org name matches known hosting provider: ${geo.org}`,
            value: geo.org,
        });
    }

    // ─── AbuseIPDB reputation ────────────────────────────────
    const abuse = abuseInfo.status === 'fulfilled' ? abuseInfo.value : { abuseConfidenceScore: 0, totalReports: 0 };

    if (abuse.abuseConfidenceScore > 50) {
        score += Math.min(40, Math.round(abuse.abuseConfidenceScore * 0.4));
        signals.push({
            module: 'IP', signal: 'HIGH_ABUSE_SCORE', severity: abuse.abuseConfidenceScore > 75 ? 'CRITICAL' : 'HIGH',
            description: `AbuseIPDB confidence: ${abuse.abuseConfidenceScore}% (${abuse.totalReports} reports)`,
            value: abuse.abuseConfidenceScore,
        });
    } else if (abuse.totalReports > 5) {
        score += 10;
        signals.push({
            module: 'IP', signal: 'ABUSE_REPORTS', severity: 'MEDIUM',
            description: `IP has ${abuse.totalReports} abuse reports (confidence: ${abuse.abuseConfidenceScore}%)`,
            value: abuse.totalReports,
        });
    }

    // ─── TOR detection ───────────────────────────────────────
    const isTor = isTorNode.status === 'fulfilled' ? isTorNode.value : false;
    if (isTor) {
        score += 50;
        signals.push({
            module: 'IP', signal: 'TOR_EXIT_NODE', severity: 'CRITICAL',
            description: 'IP is a known TOR exit node',
        });
    }

    // ─── Residential proxy detection ─────────────────────────
    const isResidentialProxy = detectResidentialProxy(geo, proxy, ipApiIs);
    if (isResidentialProxy) {
        score += 45;
        signals.push({
            module: 'IP', signal: 'RESIDENTIAL_PROXY', severity: 'CRITICAL',
            description: 'Residential proxy detected — sophisticated evasion technique',
        });
    }

    // ─── Impossible travel ───────────────────────────────────
    if (userId && geo.lat && geo.lon) {
        const impossibleTravel = await checkImpossibleTravel(userId, geo.lat, geo.lon);
        if (impossibleTravel) {
            score += 30;
            signals.push({
                module: 'IP', signal: 'IMPOSSIBLE_TRAVEL', severity: 'HIGH',
                description: 'Impossible travel detected — IP location inconsistent with previous activity',
            });
        }
    }

    // ─── Geo-mismatch with phone country ─────────────────────
    // (cross-module signal — flagged here for enrichment)
    if (geo.countryCode) {
        signals.push({
            module: 'IP', signal: 'GEO_RESOLVED', severity: 'LOW',
            description: `IP geo: ${geo.city || 'unknown'}, ${geo.regionName || ''}, ${geo.country || geo.countryCode}`,
            value: geo.countryCode,
        });
    }

    return {
        score: Math.min(100, score),
        isVpn: proxy.proxy || ipApiIs?.isVpn || false,
        isProxy: proxy.proxy || false,
        isTor,
        isDatacenter: proxy.hosting || false,
        isResidentialProxy,
        geo,
        asn: geo.as ? analyzeASN(geo) : undefined,
        abuseConfidenceScore: abuse.abuseConfidenceScore,
        totalAbuseReports: abuse.totalReports,
        signals,
    };
}

// ─── ip-api.com Geolocation ──────────────────────────────────
async function getGeoData(ip: string): Promise<GeoData> {
    try {
        const url = process.env.IP_API_KEY
            ? `https://pro.ip-api.com/json/${ip}?fields=66846719&key=${process.env.IP_API_KEY}`
            : `http://ip-api.com/json/${ip}?fields=66846719`;

        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!response.ok) return {} as GeoData;
        const data = await response.json();

        return {
            country: data.country,
            countryCode: data.countryCode,
            region: data.region,
            regionName: data.regionName,
            city: data.city,
            zip: data.zip,
            lat: data.lat,
            lon: data.lon,
            timezone: data.timezone,
            isp: data.isp,
            org: data.org,
            as: data.as,
        };
    } catch {
        return {} as GeoData;
    }
}

// ─── Proxy Detection (ip-api.com pro fields) ─────────────────
async function getProxyDetection(ip: string): Promise<{ proxy: boolean; hosting: boolean }> {
    try {
        const response = await fetch(
            `http://ip-api.com/json/${ip}?fields=proxy,hosting`,
            { signal: AbortSignal.timeout(5000) }
        );
        if (!response.ok) return { proxy: false, hosting: false };
        const data = await response.json();
        return { proxy: !!data.proxy, hosting: !!data.hosting };
    } catch {
        return { proxy: false, hosting: false };
    }
}

// ─── ipapi.is Deep VPN/Proxy Detection ──────────────────────
async function checkIpApiIs(ip: string): Promise<{ isVpn: boolean; isCrawler: boolean; vpnProvider?: string } | null> {
    try {
        const response = await fetch(`https://api.ipapi.is/?q=${ip}`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return null;
        const data = await response.json();
        return {
            isVpn: data.is_vpn || false,
            isCrawler: data.is_crawler || false,
            vpnProvider: data.company?.name || undefined,
        };
    } catch {
        return null;
    }
}

// ─── AbuseIPDB Integration ──────────────────────────────────
async function checkAbuseIPDB(ip: string): Promise<{ abuseConfidenceScore: number; totalReports: number }> {
    try {
        const apiKey = process.env.ABUSEIPDB_API_KEY;
        if (!apiKey) return { abuseConfidenceScore: 0, totalReports: 0 };

        const response = await fetch(
            `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90`,
            {
                headers: {
                    'Key': apiKey,
                    'Accept': 'application/json',
                },
                signal: AbortSignal.timeout(5000),
            }
        );

        if (!response.ok) return { abuseConfidenceScore: 0, totalReports: 0 };
        const data = await response.json();
        return {
            abuseConfidenceScore: data.data?.abuseConfidenceScore || 0,
            totalReports: data.data?.totalReports || 0,
        };
    } catch {
        return { abuseConfidenceScore: 0, totalReports: 0 };
    }
}

// ─── TOR Exit Node Detection ─────────────────────────────────
let torExitNodes: Set<string> | null = null;
let torLastFetch = 0;

async function checkTorExitNode(ip: string): Promise<boolean> {
    try {
        const now = Date.now();
        // Refresh TOR list every hour
        if (!torExitNodes || now - torLastFetch > 3600000) {
            const response = await fetch(TOR_CHECK_URL, {
                signal: AbortSignal.timeout(10000),
            });
            if (response.ok) {
                const text = await response.text();
                torExitNodes = new Set(
                    text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
                );
                torLastFetch = now;
            }
        }
        return torExitNodes?.has(ip) || false;
    } catch {
        return false;
    }
}

// ─── ASN Analysis ────────────────────────────────────────────
function analyzeASN(geo: GeoData): ASNData | undefined {
    if (!geo.as) return undefined;
    const asnMatch = geo.as.match(/^AS(\d+)\s*(.*)/);
    if (!asnMatch) return undefined;
    const asnNumber = parseInt(asnMatch[1]);
    return {
        asn: asnNumber,
        org: asnMatch[2] || geo.org || '',
        isp: geo.isp || '',
        isHosting: isDatacenterASN(asnNumber) || isHostingByOrgName(geo.org || ''),
    };
}

// ─── Residential Proxy Detection ─────────────────────────────
function detectResidentialProxy(
    geo: GeoData,
    proxyInfo: { proxy: boolean; hosting: boolean },
    ipApiIs: { isVpn: boolean; isCrawler: boolean } | null
): boolean {
    // Residential proxies look like residential IPs but behave like proxies
    // Signals: ISP is residential but ASN is proxy-related, or
    // ip-api says not hosting but ipapi.is says VPN

    if (!proxyInfo.hosting && ipApiIs?.isVpn) {
        return true; // Looks residential but is actually VPN → residential proxy
    }

    if (geo.as) {
        const asnMatch = geo.as.match(/^AS(\d+)/);
        if (asnMatch && isProxyASN(parseInt(asnMatch[1]))) {
            return true;
        }
    }

    // Check for known residential proxy providers in org name
    const orgLower = (geo.org || '').toLowerCase();
    const residentialProxyKeywords = ['bright data', 'luminati', 'oxylabs', 'netnut',
        'smartproxy', 'geosurf', 'packetstream', 'webshare', 'storm proxies', 'iproyal'];
    return residentialProxyKeywords.some(kw => orgLower.includes(kw));
}

// ─── Impossible Travel Detection ─────────────────────────────
async function checkImpossibleTravel(
    userId: string,
    currentLat: number,
    currentLon: number
): Promise<boolean> {
    try {
        const { data: lastEvent } = await supabaseAdmin
            .from('ts_risk_events')
            .select('created_at, enrichment')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!lastEvent?.enrichment?.ip?.geo) return false;

        const prevGeo = lastEvent.enrichment.ip.geo;
        if (!prevGeo.lat || !prevGeo.lon) return false;

        const distance = haversineDistance(
            prevGeo.lat, prevGeo.lon,
            currentLat, currentLon
        );

        const timeDiffHours = (Date.now() - new Date(lastEvent.created_at).getTime()) / (1000 * 60 * 60);
        if (timeDiffHours <= 0) return false;

        // Average commercial flight speed: ~900 km/h, add margin
        const maxSpeed = 1200; // km/h
        const maxDistance = maxSpeed * timeDiffHours;

        return distance > maxDistance && distance > 500; // Min 500km to flag
    } catch {
        return false;
    }
}
