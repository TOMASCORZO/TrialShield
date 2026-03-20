// TrialShield Configuration — All thresholds and weights are configurable

export const CONFIG = {
    // ─── Decision Thresholds ────────────────────────────────────
    thresholds: {
        allow: 30,       // score 0-30 → ALLOW
        challenge: 70,   // score 31-70 → CHALLENGE
        deny: 100,       // score 71-100 → DENY
    },

    // ─── Module Weights (must sum to 1.0) ───────────────────────
    weights: {
        email: 0.20,
        phone: 0.10,
        ip: 0.25,
        device: 0.20,
        behavior: 0.10,
        graph: 0.15,
    },

    // ─── Velocity Limits ────────────────────────────────────────
    velocity: {
        signupsPerIpPerHour: 3,
        signupsPerDevicePerDay: 2,
        signupsPerEmailDomainPerHour: 5,
        loginsPerIpPerMinute: 10,
        apiCallsPerMinute: 60,
    },

    // ─── Challenge Tiers ────────────────────────────────────────
    challengeTiers: {
        low: { min: 0, max: 30, challenge: 'NONE' as const },
        medium: { min: 31, max: 50, challenge: 'INVISIBLE_CAPTCHA' as const },
        high: { min: 51, max: 70, challenge: 'PHONE_VERIFICATION' as const },
        critical: { min: 71, max: 100, challenge: 'MANUAL_REVIEW' as const },
    },

    // ─── Post-Signup Monitoring ─────────────────────────────────
    // RELAXED: 10x more lenient to avoid disturbing legitimate users
    monitoring: {
        maxApiCallsPerMinute: 300,     // Was 100 — very lenient
        maxFeaturesPerHour: 200,       // Was 50 — very lenient
        anomalyThreshold: 4.0,         // Was 2.5 — only flag extreme outliers
        quarantineScore: 95,           // Was 80 — only quarantine near-certain abusers
    },

    // ─── Rate Limiting ──────────────────────────────────────────
    rateLimiting: {
        requestsPerMinute: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '60'),
        burstSize: parseInt(process.env.RATE_LIMIT_BURST || '10'),
    },

    // ─── Email Intelligence ─────────────────────────────────────
    email: {
        roleBasedPrefixes: [
            'admin', 'administrator', 'info', 'contact', 'support', 'help',
            'sales', 'marketing', 'billing', 'noreply', 'no-reply', 'postmaster',
            'webmaster', 'abuse', 'hostmaster', 'root', 'security', 'team',
            'office', 'mail', 'hello', 'hi', 'feedback', 'press', 'media',
            'jobs', 'careers', 'legal', 'privacy', 'compliance', 'hr',
        ],
        gmailDomains: ['gmail.com', 'googlemail.com'],
        highRiskTlds: ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.click', '.buzz'],
    },

    // ─── Phone Intelligence ─────────────────────────────────────
    phone: {
        voipProviders: [
            'twilio', 'google voice', 'textnow', 'textfree', 'pinger',
            'bandwidth', 'vonage', 'ringcentral', 'grasshopper', 'burner',
            'hushed', 'sideline', 'dingtone', 'talkatone', 'freedompop',
            'magicjack', 'ooma', 'line2', 'openphone',
        ],
        highRiskCountries: ['NG', 'GH', 'PH', 'IN', 'PK', 'BD', 'VN', 'KE'],
        mediumRiskCountries: ['BR', 'MX', 'CO', 'PE', 'AR', 'CL', 'EC'],
    },

    // ─── IP Intelligence ────────────────────────────────────────
    ip: {
        datacenterAsns: [
            13335, 20940, 16509, 14618, 15169, 8075, 396982, 13238,
            54113, 32934, 46489, 62567, 24940, 16276, 63949,
        ],
        hostingKeywords: [
            'amazon', 'aws', 'google', 'gcp', 'microsoft', 'azure', 'digital ocean',
            'linode', 'vultr', 'ovh', 'hetzner', 'cloudflare', 'akamai',
            'oracle cloud', 'ibm cloud', 'alibaba', 'tencent',
        ],
    },

    // ─── Country Risk Weights ───────────────────────────────────
    countryRisk: {
        HIGH: 25,
        MEDIUM: 15,
        LOW: 0,
    },

    // ─── Feature Flags ──────────────────────────────────────────
    features: {
        shadowMode: false,                // Log but don't enforce decisions
        enableBreachCheck: true,          // HaveIBeenPwned integration
        enableAbuseIPDB: true,            // AbuseIPDB integration
        enableDeviceFingerprint: true,    // Client SDK fingerprinting
        enableGraphAnalysis: true,        // Graph link analysis
        enablePostSignupMonitoring: true, // Post-signup velocity monitoring
        enableContinuousMonitoring: true, // Continuous user monitoring (v2)
        enableContentFingerprinting: true,// File/image/project fingerprinting
        enableGithubMonitoring: true,     // GitHub link/repo tracking
    },

    // ─── Match Scoring (v2 Continuous Monitoring) ────────────────
    matchScoring: {
        // How much each anchor type contributes to match confidence
        anchorWeights: {
            device: 0.95,        // Device fingerprint = near-certain match
            email: 0.90,         // Same email = very strong
            phone: 0.85,         // Same phone = strong
            
            // Payment Anchors
            card_fingerprint: 0.95, // Exact card hash from Stripe = near-certain match
            card_bin_last4: 0.40,  // BIN + Last4 matches = moderate match (reduced for large DB collisions)
            card_last4_zip: 0.50, // Same Last4 AND Same Zip Code
            card_bin: 0.00,      // Same BIN only = NO PENALTY (Avoid false positives from same bank)
            card_name: 0.20,     // Same cardholder name 
            billing_zip: 0.15,   // Same billing zip postal code
            card_country: 0.05,  // Same card issuance country (mostly for graph clustering)

            browser_fp: 0.50,    // Similar browser = moderate
            github_account: 0.85,// Same GitHub account = strong
            ip: 0.40,            // Same IP = weak (shared networks)
        },
        // Content reuse weights — RELAXED: 3-5x lower to avoid false positives
        contentWeights: {
            file_hash: 0.20,     // Was 0.70 — relaxed
            image_hash: 0.15,    // Was 0.65 — relaxed
            project_name: 0.15,  // Was 0.60 — relaxed
            github_link: 0.20,   // Was 0.75 — relaxed
            github_repo: 0.25,   // Was 0.80 — relaxed
            ai_session: 0.15,    // Was 0.55 — relaxed
            ai_query: 0.10,      // Was 0.45 — relaxed
            text_snippet: 0.10,  // Was 0.40 — relaxed
            url: 0.10,           // Was 0.50 — relaxed
        },
        // Sensitivity presets (match threshold %)
        presets: {
            strict: 30,          // Aggressive: revoke at 30% match
            balanced: 60,        // Recommended: revoke at 60%
            lenient: 85,         // Conservative: revoke at 85%
        },
    },

    // ─── Context Weights (v3) ───────────────────────────────────
    // RELAXED: 10x more lenient — monitoring is informational, not punitive
    contextWeights: {
        github_repo: 2,            // Was 20 — 10x lower
        github_private_repo: 6,    // Was 60 — 10x lower
        ai_prompt: 1,              // Was 15 — 10x lower
        api_key: 8,                // Was 80 — 10x lower
        database_url: 8,           // Was 80 — 10x lower
        project_config: 5,         // Was 50 — 10x lower
        webhook_url: 7,            // Was 70 — 10x lower
        env_variable: 6,           // Was 65 — 10x lower
        default: 2,                // Was 25 — 10x lower
    },

    // ─── Duplicate User Engine (v3) ─────────────────────────────
    duplicateEngine: {
        // Classification thresholds (pairwise score)
        definiteThreshold: 85,     // > 85% → DEFINITE duplicate
        probableThreshold: 60,     // 60-85% → PROBABLE duplicate
        possibleThreshold: 30,     // 30-60% → POSSIBLE duplicate
        // Below 30% → UNLIKELY
        abuseRingMinSize: 3,       // Min connected users to flag as abuse ring
        maxBFSDepth: 2,            // How deep to search the similarity graph
    },

    // ─── Content Velocity (v3) ──────────────────────────────────
    // RELAXED: higher thresholds to avoid false positives
    contentVelocity: {
        windowMinutes: 30,         // Was 60 — shorter window
        userThreshold: 8,          // Was 3 — much higher threshold to trigger
    },

    // ─── Collaborator vs Duplicate Factors (v3) ─────────────────
    // Positive = more likely DUPLICATE, Negative = more likely COLLABORATOR
    // RELAXED: bias heavily toward "collaborator" to avoid false positives
    collaboratorFactors: {
        sharedDevice: 40,          // Same device → strong duplicate signal (unchanged)
        sharedIP: 10,              // Was 20 — reduced (offices share IPs)
        sameOrg: -80,              // Was -50 — stronger collab signal
        sameEmailDomain: -50,      // Was -30 — stronger collab signal
        simultaneousActivity: 15,  // Was 30 — reduced
        complementaryContent: -30, // Was -20 — stronger collab signal
        identicalBehavior: 15,     // Was 25 — reduced
        trialActiveMultiplier: 0.3, // Was 0.5 — even more lenient for active trials
    },
} as const;

export type Config = typeof CONFIG;
