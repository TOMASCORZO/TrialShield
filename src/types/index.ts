// TrialShield Core Types

// ─── Account Status ───────────────────────────────────────────
export type AccountStatus = 'trial_active' | 'trial_expired' | 'paid';

// ─── Decision Types ───────────────────────────────────────────
export type Decision = 'ALLOW' | 'DENY' | 'CHALLENGE';

export type ChallengeType =
    | 'NONE'
    | 'INVISIBLE_CAPTCHA'
    | 'EMAIL_VERIFICATION'
    | 'PHONE_VERIFICATION'
    | 'TWO_FACTOR_AUTH'
    | 'CARD_VERIFICATION'
    | 'MANUAL_REVIEW';

// ─── Verify Request / Response ────────────────────────────────
export interface VerifyRequest {
    email?: string;
    phone?: string;
    ip?: string;
    deviceFingerprint?: DeviceFingerprint;
    userAgent?: string;
    sessionId?: string;
    organizationId?: string; // Users in the same org are exempt from content overlap bans
    oauthProvider?: {               // OAuth provider data for account age analysis
        provider: 'google' | 'github' | 'apple' | 'microsoft' | 'discord' | 'other';
        accessToken?: string;       // OAuth access token — TrialShield auto-fetches metadata
        providerId?: string;        // Provider's user ID
        createdAt?: string;         // ISO timestamp of account creation on the provider
        avatarUrl?: string;
        name?: string;
        verified?: boolean;
        // GitHub-specific
        githubUsername?: string;
        githubPublicRepos?: number;
        githubFollowers?: number;
        githubCreatedAt?: string;
        // Google-specific
        googleLocale?: string;
        googlePicture?: string;
    };
    metadata?: Record<string, unknown>;
}

export interface VerifyResponse {
    id: string;
    decision: Decision;
    riskScore: number; // 0-100
    signals: RiskSignal[];
    breakdown: ScoreBreakdown;
    challenge?: ChallengeConfig;
    enrichment: EnrichmentData;
    processingTimeMs: number;
    timestamp: string;
}

// ─── Risk Signals ─────────────────────────────────────────────
export interface RiskSignal {
    module: ModuleName;
    signal: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
    value?: string | number | boolean;
}

export type ModuleName =
    | 'EMAIL'
    | 'PHONE'
    | 'IP'
    | 'DEVICE'
    | 'BEHAVIOR'
    | 'GRAPH'
    | 'OAUTH'
    | 'RULES';

// ─── Score Breakdown ──────────────────────────────────────────
export interface ScoreBreakdown {
    emailScore: number;
    phoneScore: number;
    ipScore: number;
    deviceScore: number;
    behaviorScore: number;
    graphScore: number;
    finalScore: number;
    weights: Record<string, number>;
}

// ─── Device Fingerprint ───────────────────────────────────────
export interface DeviceFingerprint {
    id: string;
    canvas?: string;
    webgl?: string;
    audio?: string;
    fonts?: string[];
    screen?: { width: number; height: number; colorDepth: number };
    timezone?: string;
    language?: string;
    platform?: string;
    hardwareConcurrency?: number;
    deviceMemory?: number;
    touchSupport?: boolean;
    plugins?: string[];
    userAgent?: string;
    headless?: boolean;
    automationDetected?: boolean;
    spoofingDetected?: boolean;
    // Mobile specific
    idfv?: string;              // iOS Identifier for Vendor
    androidId?: string;         // Android Secure Settings ID
    hardwareModel?: string;     // Raw device model string (e.g. iPhone14,2)
    isEmulator?: boolean;
    isRooted?: boolean;
    isJailbroken?: boolean;
}

// ─── Email Analysis ───────────────────────────────────────────
export interface EmailAnalysis {
    score: number;
    normalized: string;
    isDisposable: boolean;
    isCatchAll: boolean;
    isRoleBased: boolean;
    hasMxRecords: boolean;
    mxProvider?: string;
    isBreached: boolean;
    breachCount?: number;
    aliasDetected: boolean;
    dotTrickDetected: boolean;
    domainAge?: string;
    signals: RiskSignal[];
}

// ─── Phone Analysis ───────────────────────────────────────────
export interface PhoneAnalysis {
    score: number;
    normalized: string;
    countryCode: string;
    country: string;
    carrierName?: string;
    lineType: 'MOBILE' | 'VOIP' | 'LANDLINE' | 'UNKNOWN';
    isVoip: boolean;
    countryRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    isValid: boolean;
    signals: RiskSignal[];
}

// ─── IP Analysis ──────────────────────────────────────────────
export interface IPAnalysis {
    score: number;
    ip?: string;
    isVpn: boolean;
    isProxy: boolean;
    isTor: boolean;
    isDatacenter: boolean;
    isResidentialProxy: boolean;
    abuseConfidenceScore: number;
    totalAbuseReports?: number;
    geo?: GeoData;
    asn?: ASNData;
    impossibleTravel?: boolean;
    signals: RiskSignal[];
}

export interface GeoData {
    country?: string;
    countryCode?: string;
    region?: string;
    regionName?: string;
    city?: string;
    zip?: string;
    lat?: number;
    lon?: number;
    timezone?: string;
    isp?: string;
    org?: string;
    as?: string;
}

export interface ASNData {
    asn: number;
    org?: string;
    isp?: string;
    isHosting: boolean;
}

// ─── Behavioral Analysis ──────────────────────────────────────
export interface BehaviorAnalysis {
    score: number;
    velocityFlags: VelocityFlag[];
    botScore: number;
    sessionAnomaly: boolean;
    signals: RiskSignal[];
}

export interface VelocityFlag {
    type: 'signup' | 'login' | 'api_call';
    window: string;
    count: number;
    threshold: number;
    exceeded: boolean;
}

// ─── Graph Analysis ───────────────────────────────────────────
export interface GraphAnalysis {
    score: number;
    linkedAccounts: number;
    deviceCluster: string[];
    ipCluster: string[];
    emailDomainCluster: string[];
    coordinatedAttack: boolean;
    signals: RiskSignal[];
}

// ─── Challenge Config ─────────────────────────────────────────
export interface ChallengeConfig {
    type: ChallengeType;
    tier: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    actions: string[];
    webhookUrl?: string;
}

// ─── Enrichment Data ──────────────────────────────────────────
export interface EnrichmentData {
    totalSignals: number;
    email?: Partial<EmailAnalysis>;
    phone?: Partial<PhoneAnalysis>;
    ip?: Partial<IPAnalysis>;
    device?: Partial<DeviceFingerprint>;
    behavior?: Partial<BehaviorAnalysis>;
    graph?: Partial<GraphAnalysis>;
    oauth?: Record<string, unknown>;
    socialProfiles?: string[];
}

// ─── Monitoring ───────────────────────────────────────────────
export interface MonitorEvent {
    userId: string;
    eventType: 'api_call' | 'feature_use' | 'login' | 'data_export' | 'suspicious_action';
    metadata?: Record<string, unknown>;
    organizationId?: string; // Passed at runtime to override checks
    accountStatus?: AccountStatus; // Trial/paid status of the triggering user
    deviceFingerprint?: DeviceFingerprint; // Captured live during session
    content?: { label: string; hash: string }[]; // Hard-linked content (files, private media)
    context?: { label: string; hash: string }[]; // Soft-linked context (GitHub URLs, generic prompts)
    timestamp: string;
}

export interface MonitorResult {
    userId: string;
    usageVelocity: number;
    anomalyScore: number;
    contextRiskScore: number; // Isolated scoring regime for contextual overlaps
    isRevoked: boolean;
    action: 'NONE' | 'WARN' | 'THROTTLE' | 'REVOKE' | 'BLOCK';
}

// ─── API Key ──────────────────────────────────────────────────
export interface ApiKey {
    id: string;
    name: string;
    key: string;
    hashedKey: string;
    createdAt: string;
    lastUsed?: string;
    rateLimit: number;
    isActive: boolean;
}

// ─── Audit Log ────────────────────────────────────────────────
export interface AuditLog {
    id: string;
    timestamp: string;
    apiKeyId: string;
    endpoint: string;
    request: Record<string, unknown>;
    response: {
        decision: Decision;
        riskScore: number;
    };
    processingTimeMs: number;
    ip: string;
}

// ─── Feedback ─────────────────────────────────────────────────
export interface FeedbackRequest {
    evaluationId: string;
    isAbuser: boolean;
    notes?: string;
}

// ─── Dashboard Stats ──────────────────────────────────────────
export interface DashboardStats {
    totalEvaluations: number;
    evaluationsToday: number;
    allowRate: number;
    denyRate: number;
    challengeRate: number;
    avgRiskScore: number;
    topSignals: { signal: string; count: number }[];
    recentEvaluations: VerifyResponse[];
    riskDistribution: { range: string; count: number }[];
}

// ═══════════════════════════════════════════════════════════════
// CONTINUOUS MONITORING TYPES (v2)
// ═══════════════════════════════════════════════════════════════

// ─── Identity Anchor Types ────────────────────────────────────
export type AnchorType = 'device' | 'ip' | 'email' | 'phone' | 'card_bin' | 'card_last4_zip' | 'card_bin_last4' | 'card_fingerprint' | 'card_name' | 'billing_zip' | 'card_country' | 'browser_fp' | 'github_account' | 'context' | 'content_fingerprint';

export interface IdentityAnchor {
    userId: string;
    anchorType: AnchorType;
    anchorHash: string;
    confidence: number;
    firstSeen: string;
    lastSeen: string;
    timesSeen: number;
}

export interface IdentityResolution {
    resolvedUserId: string;
    isNewUser: boolean;
    matchedAnchors: IdentityAnchor[];
    matchScore: number;         // 0-100 cumulative match percentage
    matchedToUsers: string[];   // Other user IDs this identity matches
}

// ─── Content Fingerprint Types ────────────────────────────────
export type ContentType =
    | 'file_hash'
    | 'image_hash'
    | 'project_name'
    | 'github_link'
    | 'github_repo'
    | 'ai_session'
    | 'ai_query'
    | 'text_snippet'
    | 'url'
    | 'email_pattern'
    | 'simhash';              // Fuzzy text similarity hash

export interface ContentFingerprint {
    userId: string;
    contentType: ContentType;
    contentHash: string;
    originalValue?: string;
    fileSize?: number;
    metadata?: Record<string, unknown>;
    firstSeen: string;
    timesSeen: number;
}

export interface ContentReuseResult {
    isReused: boolean;
    originalUserId?: string;
    contentType: ContentType;
    originalValue?: string;
    matchBoost: number;         // How much this adds to match score (0-100)
    totalReuseCount: number;    // How many users have used this content
    skippedReason?: 'paid_user' | 'collaborator' | 'same_org'; // Why penalty was not applied
    matchedAccountStatus?: AccountStatus;  // Status of the matched user
}

// ─── Activity Tracking Types ──────────────────────────────────
export type ActivityType =
    | 'ai_query'
    | 'file_upload'
    | 'file_download'
    | 'project_create'
    | 'project_open'
    | 'github_link'
    | 'image_upload'
    | 'login'
    | 'feature_use'
    | 'export';

export interface TrackRequest {
    userId: string;
    activityType: ActivityType;
    accountStatus?: AccountStatus;   // Trial/paid status
    deviceFingerprint?: DeviceFingerprint;
    ip?: string;
    metadata?: {
        query?: string;             // AI query text
        fileName?: string;
        fileHash?: string;          // SHA-256 of file content
        fileSize?: number;
        imageHash?: string;         // Perceptual hash of image
        projectName?: string;
        githubLink?: string;        // GitHub URL
        githubRepo?: string;        // owner/repo format
        featureName?: string;
        sessionId?: string;         // AI session ID for grouping
        contentSnippet?: string;    // Text snippet for similarity
        [key: string]: unknown;
    };
}

export interface TrackResponse {
    matchScore: number;            // 0-100 current match level
    status: 'OK' | 'WARN' | 'REVOKE';
    matchedUserId?: string;
    signals: RiskSignal[];
    contentReuse: ContentReuseResult[];
    enforcement?: EnforcementAction;
    duplicateReport?: DuplicateReport; // Present when duplicates detected
    activityId: string;
}

// ─── Match Score Types ────────────────────────────────────────
export interface MatchResult {
    score: number;                 // 0-100 overall match percentage
    breakdown: MatchBreakdown;
    matchedUsers: MatchedUser[];
    isAbuser: boolean;             // True if score >= client threshold
}

export interface MatchBreakdown {
    deviceMatch: number;           // 0-100
    emailMatch: number;
    phoneMatch: number;
    ipMatch: number;
    cardMatch: number;             // For BIN + Last4 combination
    cardLast4ZipMatch: number;     // For Last4 + Zip combination
    cardFingerprintMatch: number;
    cardNameMatch: number;
    billingZipMatch: number;
    cardCountryMatch: number;
    browserMatch: number;
    contentMatch: number;          // Content reuse contribution
    aiSessionMatch: number;        // Repeated AI sessions
    githubMatch: number;           // GitHub link/repo reuse
}

export interface MatchedUser {
    userId: string;
    matchScore: number;
    sharedAnchors: AnchorType[];
    sharedContent: ContentType[];
}

// ─── Client Settings Types ────────────────────────────────────
export type Sensitivity = 'strict' | 'balanced' | 'lenient' | 'custom';

export interface ClientSettings {
    apiKeyId: string;
    sensitivity: Sensitivity;
    matchThreshold: number;        // 0-100
    autoRevoke: boolean;
    notifyWebhook?: string;
    monitorContent: boolean;
    monitorAiUsage: boolean;
    monitorGithub: boolean;
}

// ─── Enforcement Types ────────────────────────────────────────
export interface EnforcementAction {
    action: 'NONE' | 'WARN' | 'THROTTLE' | 'REVOKE' | 'BLOCK';
    reason: string;
    matchScore: number;
    threshold: number;
    matchedUserId?: string;
    revokedAt?: string;
}

// ═══════════════════════════════════════════════════════════════
// DUPLICATE USER ENGINE TYPES (v3)
// ═══════════════════════════════════════════════════════════════

export type DuplicateClassification = 'DEFINITE' | 'PROBABLE' | 'POSSIBLE' | 'UNLIKELY';

export interface CollaboratorSignal {
    factor: string;             // 'shared_device' | 'shared_ip' | 'same_org' | 'same_email_domain' | etc
    weight: number;             // Positive = more likely duplicate, Negative = more likely collaborator
    description: string;
}

export interface CollaboratorAnalysis {
    isDuplicate: boolean;       // Final verdict
    duplicateScore: number;     // 0-100 (high = definitely duplicate)
    collaboratorScore: number;  // 0-100 (high = definitely collaborator)
    signals: CollaboratorSignal[];
}

export interface DuplicateCandidate {
    userId: string;
    pairwiseScore: number;      // 0-100 match confidence
    classification: DuplicateClassification;
    accountStatus: AccountStatus;
    sharedDimensions: string[]; // e.g. ['device', 'content:file_hash', 'context:github_repo']
    collaboratorAnalysis?: CollaboratorAnalysis; // Only for trial_active users
}

export interface DuplicateReport {
    userId: string;
    candidates: DuplicateCandidate[];
    highestScore: number;
    classification: DuplicateClassification;
    abuseRingDetected: boolean;
    abuseRingSize?: number;
}
