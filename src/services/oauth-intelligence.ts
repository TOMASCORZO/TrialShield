// TrialShield — OAuth Account Intelligence Module (v2 — Auto-Fetch)
// Automatically resolves account metadata from OAuth providers using access tokens:
// - GitHub: GET /user → created_at, public_repos, followers, avatar, name
// - Google: GET Drive API → root folder createdTime (= account creation date)
//           GET userinfo → email, name, picture, verified, locale
// Analyzes account age, profile completeness, provider-specific signals

import { RiskSignal } from '@/types';

// ─── Types ───────────────────────────────────────────────────
export type OAuthProviderType = 'google' | 'github' | 'apple' | 'microsoft' | 'discord' | 'other';

export interface OAuthData {
    provider: OAuthProviderType;
    accessToken?: string;          // OAuth access token — if provided, we auto-fetch metadata
    // Manual fields (used if accessToken not provided, or to supplement)
    providerId?: string;
    email?: string;
    createdAt?: string;            // ISO timestamp of account creation
    avatarUrl?: string;
    name?: string;
    verified?: boolean;
    // GitHub-specific (auto-populated if accessToken given)
    githubUsername?: string;
    githubPublicRepos?: number;
    githubFollowers?: number;
    githubFollowing?: number;
    githubCreatedAt?: string;
    githubBio?: string;
    githubGists?: number;
    // Google-specific (auto-populated if accessToken given)
    googleLocale?: string;
    googlePicture?: string;
    googleDriveCreatedAt?: string;  // Root folder creation time = account age
}

export interface OAuthAnalysis {
    score: number;
    provider: OAuthProviderType;
    accountAgeDays: number | null;
    signals: RiskSignal[];
    isNewAccount: boolean;
    isVeryNewAccount: boolean;
    hasAvatar: boolean;
    hasCompleteName: boolean;
    isVerified: boolean;
    resolvedMetadata: Partial<OAuthData>;  // What we auto-fetched
}

// ─── Configuration ────────────────────────────────────────────
const OAUTH_CONFIG = {
    veryNewAccountHours: 24,
    newAccountDays: 3,
    suspiciousAccountDays: 7,
    veryNewAccountPenalty: 35,
    newAccountPenalty: 25,
    suspiciousAccountPenalty: 15,
    noAvatarPenalty: 5,
    noNamePenalty: 5,
    unverifiedEmailPenalty: 10,
    githubNoReposPenalty: 10,
    githubNoFollowersPenalty: 5,
    githubNewAccountBonus: 10,
    establishedAccountReduction: -10,
    veteranAccountReduction: -15,
    fetchTimeoutMs: 5000,
};

// ═══════════════════════════════════════════════════════════════
// AUTO-FETCH: Resolve provider metadata from access token
// ═══════════════════════════════════════════════════════════════

// ─── GitHub: Full automatic resolution ───────────────────────
// Requires: token from GitHub OAuth (scope: read:user)
// Endpoint: GET https://api.github.com/user
async function fetchGitHubProfile(accessToken: string): Promise<Partial<OAuthData>> {
    try {
        const response = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'TrialShield-API',
            },
            signal: AbortSignal.timeout(OAUTH_CONFIG.fetchTimeoutMs),
        });

        if (!response.ok) {
            console.error(`[TrialShield] GitHub API returned ${response.status}`);
            return {};
        }

        const data = await response.json();

        return {
            provider: 'github',
            providerId: String(data.id),
            email: data.email || undefined,
            createdAt: data.created_at,            // ISO 8601: "2012-05-18T23:31:17Z"
            avatarUrl: data.avatar_url || undefined,
            name: data.name || data.login || undefined,
            githubUsername: data.login,
            githubPublicRepos: data.public_repos ?? 0,
            githubFollowers: data.followers ?? 0,
            githubFollowing: data.following ?? 0,
            githubCreatedAt: data.created_at,
            githubBio: data.bio || undefined,
            githubGists: data.public_gists ?? 0,
        };
    } catch (err) {
        console.error('[TrialShield] GitHub profile fetch failed:', err);
        return {};
    }
}

// ─── Google: Account creation via Drive API ─────────────────
// Strategy: The Google Drive root folder is created when the Google account is created.
// GET https://www.googleapis.com/drive/v3/files/root?fields=createdTime
// Requires scope: https://www.googleapis.com/auth/drive.metadata.readonly
//
// Also fetches userinfo for profile completeness.
async function fetchGoogleProfile(accessToken: string): Promise<Partial<OAuthData>> {
    const result: Partial<OAuthData> = { provider: 'google' };

    // 1. Fetch basic profile from userinfo
    try {
        const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(OAUTH_CONFIG.fetchTimeoutMs),
        });

        if (userinfoResponse.ok) {
            const info = await userinfoResponse.json();
            result.providerId = info.sub;
            result.email = info.email;
            result.name = info.name;
            result.verified = info.email_verified;
            result.googlePicture = info.picture;
            result.avatarUrl = info.picture;
            result.googleLocale = info.locale;
        }
    } catch (err) {
        console.error('[TrialShield] Google userinfo fetch failed:', err);
    }

    // 2. Fetch Drive root folder creation date (= Google account creation date)
    try {
        const driveResponse = await fetch(
            'https://www.googleapis.com/drive/v3/files/root?fields=createdTime',
            {
                headers: { 'Authorization': `Bearer ${accessToken}` },
                signal: AbortSignal.timeout(OAUTH_CONFIG.fetchTimeoutMs),
            }
        );

        if (driveResponse.ok) {
            const driveData = await driveResponse.json();
            if (driveData.createdTime) {
                result.googleDriveCreatedAt = driveData.createdTime;
                result.createdAt = driveData.createdTime;  // Use as primary creation date
            }
        } else {
            console.warn(`[TrialShield] Google Drive API returned ${driveResponse.status} — ` +
                'scope drive.metadata.readonly may not be granted');

            // Fallback: try People API for profile metadata dates
            await fetchGooglePeopleApiFallback(accessToken, result);
        }
    } catch (err) {
        console.error('[TrialShield] Google Drive date fetch failed:', err);
        // Try People API fallback
        await fetchGooglePeopleApiFallback(accessToken, result);
    }

    return result;
}

// Google People API fallback — tries to get profile update timestamps
async function fetchGooglePeopleApiFallback(
    accessToken: string,
    result: Partial<OAuthData>
): Promise<void> {
    try {
        const peopleResponse = await fetch(
            'https://people.googleapis.com/v1/people/me?personFields=metadata',
            {
                headers: { 'Authorization': `Bearer ${accessToken}` },
                signal: AbortSignal.timeout(OAUTH_CONFIG.fetchTimeoutMs),
            }
        );

        if (peopleResponse.ok) {
            const peopleData = await peopleResponse.json();
            // metadata.sources contains profile creation dates
            const sources = peopleData.metadata?.sources;
            if (Array.isArray(sources)) {
                for (const source of sources) {
                    if (source.updateTime && !result.createdAt) {
                        // updateTime is the earliest we can get from People API
                        result.createdAt = source.updateTime;
                    }
                }
            }
        }
    } catch {
        // People API also not available — no creation date
    }
}

// ─── Provider Auto-Resolution Router ────────────────────────
export async function resolveOAuthMetadata(oauth: OAuthData): Promise<OAuthData> {
    if (!oauth.accessToken) return oauth; // No token — use manual data as-is

    let fetched: Partial<OAuthData> = {};

    switch (oauth.provider) {
        case 'github':
            fetched = await fetchGitHubProfile(oauth.accessToken);
            break;
        case 'google':
            fetched = await fetchGoogleProfile(oauth.accessToken);
            break;
        default:
            // Other providers: no auto-fetch, use manual data
            break;
    }

    // Merge: auto-fetched data fills in gaps, manual data takes precedence
    return {
        ...fetched,
        ...oauth,
        // Ensure auto-fetched creation date is used if manual wasn't provided
        createdAt: oauth.createdAt || fetched.createdAt,
        avatarUrl: oauth.avatarUrl || fetched.avatarUrl,
        name: oauth.name || fetched.name,
        verified: oauth.verified ?? fetched.verified,
        githubUsername: oauth.githubUsername || fetched.githubUsername,
        githubPublicRepos: oauth.githubPublicRepos ?? fetched.githubPublicRepos,
        githubFollowers: oauth.githubFollowers ?? fetched.githubFollowers,
        githubFollowing: oauth.githubFollowing ?? fetched.githubFollowing,
        githubCreatedAt: oauth.githubCreatedAt || fetched.githubCreatedAt,
        githubBio: oauth.githubBio || fetched.githubBio,
        githubGists: oauth.githubGists ?? fetched.githubGists,
        googlePicture: oauth.googlePicture || fetched.googlePicture,
        googleDriveCreatedAt: oauth.googleDriveCreatedAt || fetched.googleDriveCreatedAt,
        googleLocale: oauth.googleLocale || fetched.googleLocale,
        providerId: oauth.providerId || fetched.providerId,
        email: oauth.email || fetched.email,
    };
}

// ═══════════════════════════════════════════════════════════════
// ANALYSIS: Score the resolved OAuth data
// ═══════════════════════════════════════════════════════════════

export async function analyzeOAuth(oauth: OAuthData): Promise<OAuthAnalysis> {
    // Step 1: Auto-resolve metadata from provider if accessToken given
    const resolved = await resolveOAuthMetadata(oauth);

    const signals: RiskSignal[] = [];
    let score = 0;

    const provider = resolved.provider;
    let accountAgeDays: number | null = null;
    let isNewAccount = false;
    let isVeryNewAccount = false;

    // ─── 1. Account Age Analysis (PRIMARY) ───────────────────
    const creationDate = resolved.createdAt || resolved.githubCreatedAt || resolved.googleDriveCreatedAt;

    if (creationDate) {
        const created = new Date(creationDate);
        const now = new Date();
        const ageMs = now.getTime() - created.getTime();
        const ageHours = ageMs / (1000 * 60 * 60);
        accountAgeDays = Math.floor(ageHours / 24);

        if (ageHours < OAUTH_CONFIG.veryNewAccountHours) {
            isVeryNewAccount = true;
            isNewAccount = true;
            score += OAUTH_CONFIG.veryNewAccountPenalty;
            signals.push({
                module: 'OAUTH',
                signal: 'OAUTH_VERY_NEW_ACCOUNT',
                severity: 'CRITICAL',
                description: `${provider} account created less than 24 hours ago (${Math.round(ageHours)}h)`,
                value: Math.round(ageHours),
            });
        } else if (accountAgeDays < OAUTH_CONFIG.newAccountDays) {
            isNewAccount = true;
            score += OAUTH_CONFIG.newAccountPenalty;
            signals.push({
                module: 'OAUTH',
                signal: 'OAUTH_NEW_ACCOUNT',
                severity: 'HIGH',
                description: `${provider} account created ${accountAgeDays} day(s) ago — likely created for trial abuse`,
                value: accountAgeDays,
            });
        } else if (accountAgeDays < OAUTH_CONFIG.suspiciousAccountDays) {
            score += OAUTH_CONFIG.suspiciousAccountPenalty;
            signals.push({
                module: 'OAUTH',
                signal: 'OAUTH_RECENT_ACCOUNT',
                severity: 'MEDIUM',
                description: `${provider} account is only ${accountAgeDays} days old`,
                value: accountAgeDays,
            });
        } else if (accountAgeDays > 365 * 3) {
            score += OAUTH_CONFIG.veteranAccountReduction;
            signals.push({
                module: 'OAUTH',
                signal: 'OAUTH_VETERAN_ACCOUNT',
                severity: 'LOW',
                description: `${provider} account is ${Math.floor(accountAgeDays / 365)} years old — established user`,
                value: accountAgeDays,
            });
        } else if (accountAgeDays > 365) {
            score += OAUTH_CONFIG.establishedAccountReduction;
            signals.push({
                module: 'OAUTH',
                signal: 'OAUTH_ESTABLISHED_ACCOUNT',
                severity: 'LOW',
                description: `${provider} account is ${Math.floor(accountAgeDays / 365)} year(s) old`,
                value: accountAgeDays,
            });
        }
    } else {
        signals.push({
            module: 'OAUTH',
            signal: 'OAUTH_NO_CREATION_DATE',
            severity: 'MEDIUM',
            description: `Cannot determine ${provider} account creation date — possible token scope issue`,
        });
    }

    // ─── 2. Profile Completeness ────────────────────────────
    const hasAvatar = Boolean(resolved.avatarUrl || resolved.googlePicture);
    const hasCompleteName = Boolean(resolved.name && resolved.name.trim().length > 1);
    const isVerified = resolved.verified !== false;

    if (!hasAvatar) {
        score += OAUTH_CONFIG.noAvatarPenalty;
        signals.push({
            module: 'OAUTH', signal: 'OAUTH_NO_AVATAR', severity: 'LOW',
            description: `${provider} account has no profile picture`,
        });
    }

    if (!hasCompleteName) {
        score += OAUTH_CONFIG.noNamePenalty;
        signals.push({
            module: 'OAUTH', signal: 'OAUTH_NO_NAME', severity: 'LOW',
            description: `${provider} account has no display name`,
        });
    }

    if (!isVerified) {
        score += OAUTH_CONFIG.unverifiedEmailPenalty;
        signals.push({
            module: 'OAUTH', signal: 'OAUTH_UNVERIFIED_EMAIL', severity: 'HIGH',
            description: `Email not verified by ${provider}`,
        });
    }

    // ─── 3. GitHub-Specific Analysis ────────────────────────
    if (provider === 'github') {
        const repos = resolved.githubPublicRepos ?? -1;
        const followers = resolved.githubFollowers ?? -1;
        const gists = resolved.githubGists ?? -1;

        if (repos === 0) {
            score += OAUTH_CONFIG.githubNoReposPenalty;
            signals.push({
                module: 'OAUTH', signal: 'GITHUB_NO_REPOS', severity: 'MEDIUM',
                description: 'GitHub account has zero public repositories',
                value: 0,
            });
        }

        if (followers === 0) {
            score += OAUTH_CONFIG.githubNoFollowersPenalty;
            signals.push({
                module: 'OAUTH', signal: 'GITHUB_NO_FOLLOWERS', severity: 'LOW',
                description: 'GitHub account has zero followers',
                value: 0,
            });
        }

        // Combo: new GitHub + no repos + no followers = throwaway
        if (isNewAccount && repos === 0 && followers === 0) {
            score += OAUTH_CONFIG.githubNewAccountBonus;
            signals.push({
                module: 'OAUTH', signal: 'GITHUB_THROWAWAY', severity: 'HIGH',
                description: 'New GitHub account with zero activity — likely created for trial abuse',
            });
        }

        // Positive: established GitHub with real activity
        if (repos > 5 && accountAgeDays !== null && accountAgeDays > 180) {
            score -= 10;
            signals.push({
                module: 'OAUTH', signal: 'GITHUB_ACTIVE_DEVELOPER', severity: 'LOW',
                description: `Active GitHub developer: ${repos} repos, ${gists} gists, account ${Math.floor(accountAgeDays / 30)} months old`,
                value: repos,
            });
        }

        // Extra positive: very active GitHub user
        if (repos > 20 && followers > 10 && accountAgeDays !== null && accountAgeDays > 365) {
            score -= 10;
            signals.push({
                module: 'OAUTH', signal: 'GITHUB_POWER_USER', severity: 'LOW',
                description: `Power GitHub user: ${repos} repos, ${followers} followers`,
                value: followers,
            });
        }
    }

    // ─── 4. Google-Specific Analysis ────────────────────────
    if (provider === 'google') {
        // Check for default Google avatar
        const pic = resolved.googlePicture || resolved.avatarUrl || '';
        if (pic && (pic.includes('default-user') || pic.includes('s96-c/photo.jpg'))) {
            score += 3;
            signals.push({
                module: 'OAUTH', signal: 'GOOGLE_DEFAULT_AVATAR', severity: 'LOW',
                description: 'Google account using default avatar — potentially new/throwaway',
            });
        }

        // If Drive creation date was auto-fetched, flag it
        if (resolved.googleDriveCreatedAt) {
            signals.push({
                module: 'OAUTH', signal: 'GOOGLE_DRIVE_DATE_RESOLVED', severity: 'LOW',
                description: `Google account creation date resolved via Drive API: ${resolved.googleDriveCreatedAt}`,
                value: resolved.googleDriveCreatedAt,
            });
        }
    }

    // ─── 5. Compound: New OAuth + empty profile ─────────────
    if (isNewAccount && !hasAvatar && !hasCompleteName) {
        score += 10;
        signals.push({
            module: 'OAUTH', signal: 'OAUTH_EMPTY_NEW_ACCOUNT', severity: 'HIGH',
            description: `Brand new ${provider} account with empty profile — strong abuse indicator`,
        });
    }

    return {
        score: Math.max(0, Math.min(100, score)),
        provider,
        accountAgeDays,
        signals,
        isNewAccount,
        isVeryNewAccount,
        hasAvatar,
        hasCompleteName,
        isVerified,
        resolvedMetadata: resolved,
    };
}
