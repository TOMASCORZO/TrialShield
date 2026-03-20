// TrialShield — Datacenter / Hosting / VPN ASN Database
// Known ASNs that belong to hosting providers, VPN services, and datacenters
// Real residential users should NOT come from these ASNs

export const DATACENTER_ASNS = new Set([
    // ─── Major Cloud / Hosting Providers ───────────────────────────
    // Amazon AWS
    14618, 16509, 7224, 8987,
    // Google Cloud
    15169, 396982, 36040, 36384, 36385,
    // Microsoft Azure
    8075, 8069, 3598, 200517,
    // DigitalOcean
    14061, 393406, 202018, 201229,
    // Linode (Akamai)
    63949, 398101,
    // Vultr / Choopa
    20473, 397373,
    // OVH
    16276, 35540,
    // Hetzner
    24940, 213230, 212317,
    // Cloudflare
    13335, 209242, 394536,
    // Oracle Cloud
    31898, 398089,
    // Alibaba Cloud
    45102, 134963,
    // Tencent Cloud
    132203, 45090,
    // IBM Cloud / SoftLayer
    36351, 19994,
    // Rackspace
    19994, 27357, 33070, 12200,
    // Leaseweb
    60781, 16265, 28753, 7203,
    // QuadraNet
    8100,
    // ColoCrossing
    36352,
    // SingleHop
    32475,
    // Contabo
    40021, 51167,
    // Scaleway / Online.net
    12876, 29447,
    // Kamatera
    36007,
    // UpCloud
    202053,
    // Cherry Servers
    59642,
    // Hostinger
    47583,
    // InMotion Hosting
    21321,
    // A2 Hosting / QuadraNet
    55293,
    // InterServer
    19318,
    // DreamHost
    26347,
    // GoDaddy
    26496, 21501, 398101,
    // Namecheap
    22612,
    // HostGator
    46606,
    // Bluehost
    11798,
    // SiteGround
    198605,
    // Ionos / 1&1
    8560, 8972,
    // Fastly
    54113,
    // StackPath
    33438,
    // KeyCDN
    200325,
    // BuyVM / Frantech
    53667,
    // RamNode
    3842,
    // VPSServer / Limestone
    46475,
    // Psychz Networks
    40676,
    // DataPacket
    60068,
    // ServerCheap
    35916,
    // CrownCloud
    49349,
    // Time4VPS
    62282,
]);

// ─── Known VPN Provider ASNs ─────────────────────────────────────
export const VPN_ASNS = new Set([
    // NordVPN
    212238, 208722,
    // ExpressVPN
    394711,
    // Surfshark
    209854,
    // Private Internet Access (PIA)
    19437, 209854,
    // Mullvad
    198093,
    // ProtonVPN
    209103,
    // CyberGhost
    9009,
    // Windscribe
    395839,
    // IPVanish
    33588,
    // TunnelBear
    394900,
    // IVPN
    211298,
    // Perfect Privacy
    31708,
    // AirVPN
    207990,
    // VyprVPN (Golden Frog)
    32751, 395283,
    // HideMyAss
    44571,
    // TorGuard
    53335,
    // WireGuard hosting common
    206264,
    // M247 (VPN hosting)
    9009,
    // Datacamp Limited (VPN hosting)
    212238,
    // Tzulo
    395092,
    // FDCservers
    30058,
    // B2 Net Solutions (Servermania)
    32613,
    // xTom
    4785,
]);

// ─── Known Proxy / Residential Proxy ASNs ────────────────────────
export const PROXY_ASNS = new Set([
    // Bright Data / Luminati
    200019,
    // Oxylabs
    48531,
    // NetNut
    199524,
    // Smartproxy
    209605,
    // GeoSurf
    21769,
    // PacketStream
    399486,
    // Webshare
    395954,
    // Storm Proxies
    393956,
    // ProxyRack
    26347,
    // Blazing SEO / Rayobyte
    40065,
    // IP Royal
    201011,
]);

export function isDatacenterASN(asn: number): boolean {
    return DATACENTER_ASNS.has(asn);
}

export function isVpnASN(asn: number): boolean {
    return VPN_ASNS.has(asn);
}

export function isProxyASN(asn: number): boolean {
    return PROXY_ASNS.has(asn);
}

export function isHostingASN(asn: number): boolean {
    return DATACENTER_ASNS.has(asn) || VPN_ASNS.has(asn) || PROXY_ASNS.has(asn);
}

// ─── Known hosting provider name patterns ───────────────────────
const HOSTING_KEYWORDS = [
    'amazon', 'aws', 'google cloud', 'microsoft', 'azure', 'digitalocean',
    'linode', 'vultr', 'choopa', 'ovh', 'hetzner', 'cloudflare', 'oracle',
    'alibaba', 'tencent', 'ibm', 'softlayer', 'rackspace', 'leaseweb',
    'quadranet', 'colocrossing', 'singlehop', 'contabo', 'scaleway',
    'online.net', 'kamatera', 'upcloud', 'hostinger', 'godaddy', 'bluehost',
    'namecheap', 'siteground', 'fastly', 'akamai', 'datacenter', 'hosting',
    'cloud', 'vps', 'dedicated', 'colocation', 'server', 'colo',
    'nordvpn', 'expressvpn', 'surfshark', 'cyberghost', 'mullvad',
    'protonvpn', 'windscribe', 'ipvanish', 'tunnelbear', 'hidemyass',
    'torguard', 'bright data', 'luminati', 'oxylabs', 'm247',
];

export function isHostingByOrgName(orgName: string): boolean {
    const lower = orgName.toLowerCase();
    return HOSTING_KEYWORDS.some(kw => lower.includes(kw));
}
