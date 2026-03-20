# TrialShield API Documentation

> **Base URL:** `https://your-trialshield-instance.com/api/v1`  
> **Version:** 2.0  
> **Authentication:** API key via `X-API-Key` header or `Authorization: Bearer <key>`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Endpoints](#endpoints)
   - [POST /verify](#post-verify) — Risk evaluation + identity resolution
   - [POST /track](#post-track) — Continuous activity monitoring
   - [GET/PUT /settings](#settings) — Client sensitivity config
   - [POST /monitor](#post-monitor) — Post-signup event monitoring
   - [GET /stats](#get-stats) — Dashboard statistics
   - [GET /audit](#get-audit) — Audit logs
   - [POST /feedback](#post-feedback) — Abuse feedback loop
   - [GET/POST/DELETE /keys](#keys) — API key management
   - [GET/DELETE /users/:id](#users) — User data & GDPR deletion
   - [GET /sdk](#get-sdk) — Client-side SDK script
   - [GET /health](#get-health) — System health check
3. [Risk Scoring Engine](#risk-scoring-engine)
4. [Identity Resolution System](#identity-resolution-system)
5. [Content Fingerprinting](#content-fingerprinting)
6. [Analysis Modules](#analysis-modules)
7. [Integration Guide](#integration-guide)
8. [Database Schema](#database-schema)
9. [Error Codes](#error-codes)
10. [SDK Reference](#sdk-reference)

---

## Authentication

All API endpoints (except `/health` and `/sdk`) require authentication via API key.

| Method | Header |
|--------|--------|
| API Key header | `X-API-Key: ts_abc123...` |
| Bearer token | `Authorization: Bearer ts_abc123...` |

Keys are created via the dashboard or the `/keys` endpoint. Keys are hashed with HMAC-SHA256 before storage — only the hash is persisted.

**Rate Limiting:** Configurable per key (default: 60 req/min). The middleware tracks usage per key and updates `last_used` and `total_requests` on every call.

---

## Endpoints

---

### POST /verify

**The primary endpoint.** Evaluates user risk at registration/login, resolves their persistent identity, and returns a decision.

#### Request

```json
{
  "email": "user@example.com",
  "phone": "+1234567890",
  "ip": "203.0.113.42",
  "deviceFingerprint": {
    "id": "fp_a1b2c3d4",
    "canvas": "hash_of_canvas",
    "webgl": "hash_of_webgl",
    "audio": "hash_of_audio",
    "fonts": ["Arial", "Helvetica"],
    "screen": { "width": 1920, "height": 1080, "colorDepth": 24 },
    "timezone": "America/New_York",
    "language": "en-US",
    "platform": "MacIntel",
    "hardwareConcurrency": 8,
    "deviceMemory": 16,
    "touchSupport": false,
    "plugins": ["PDF Viewer"],
    "userAgent": "Mozilla/5.0...",
    "headless": false,
    "automationDetected": false,
    "spoofingDetected": false
  },
  "userAgent": "Mozilla/5.0...",
  "sessionId": "sess_unique_id",
  "metadata": {
    "paymentBin": "424242",
    "browserTimezone": "America/New_York",
    "screenResolution": "1920x1080",
    "language": "en-US"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | ≥1 required | User's email address |
| `phone` | string | ≥1 required | Phone number (E.164 format preferred) |
| `ip` | string | ≥1 required | Client IP (auto-detected from headers if omitted) |
| `deviceFingerprint` | object | No | Device fingerprint from client SDK |
| `userAgent` | string | No | Browser user-agent string |
| `sessionId` | string | No | Unique session identifier |
| `metadata` | object | No | Additional data (payment BIN, timezone, etc.) |

> At least one of `email`, `phone`, or `ip` must be provided.

#### Response

```json
{
  "id": "eval_uuid",
  "decision": "ALLOW",
  "riskScore": 25,
  "matchScore": 0,
  "isNewUser": true,
  "resolvedUserId": "user_uuid",
  "signals": [
    {
      "module": "EMAIL",
      "signal": "ROLE_BASED_EMAIL",
      "severity": "MEDIUM",
      "description": "Email uses a role-based prefix (info@)",
      "value": "info"
    }
  ],
  "breakdown": {
    "emailScore": 15,
    "phoneScore": 0,
    "ipScore": 10,
    "deviceScore": 0,
    "behaviorScore": 0,
    "graphScore": 0,
    "finalScore": 25,
    "weights": { "email": 0.20, "phone": 0.10, "ip": 0.25, "device": 0.20, "behavior": 0.10, "graph": 0.15 }
  },
  "challenge": null,
  "enrichment": {
    "totalSignals": 2,
    "email": { "isDisposable": false, "isBreached": false, "hasMxRecords": true },
    "ip": { "isVpn": false, "isProxy": false, "isTor": false }
  },
  "processingTimeMs": 342,
  "timestamp": "2026-03-12T18:00:00.000Z"
}
```

| Field | Description |
|-------|-------------|
| `decision` | `ALLOW` / `CHALLENGE` / `DENY` |
| `riskScore` | 0-100 one-time risk score |
| `matchScore` | 0-100 identity match against existing users (v2) |
| `isNewUser` | Whether this is a first-time user |
| `resolvedUserId` | Persistent user ID resolved by the identity engine |
| `matchedUserId` | If matched to another user, their ID |
| `signals` | Array of all risk signals detected |
| `breakdown` | Per-module score breakdown |
| `challenge` | Challenge config (only when decision = CHALLENGE) |
| `enforcement` | Enforcement action details (only when match exceeds threshold) |

**Decision Thresholds:**
| Score Range | Decision |
|-------------|----------|
| 0 – 30 | ALLOW |
| 31 – 70 | CHALLENGE |
| 71 – 100 | DENY |

**Response Headers:**
- `X-Risk-Score` — Numeric risk score
- `X-Match-Score` — Identity match percentage
- `X-Decision` — ALLOW/CHALLENGE/DENY
- `X-Processing-Time` — Processing duration

---

### POST /track

**Continuous monitoring endpoint.** Called by the client's backend every time the user performs an action (file upload, AI query, project creation, etc.). Re-evaluates identity and can revoke access mid-session.

#### Request

```json
{
  "userId": "client_user_123",
  "activityType": "file_upload",
  "deviceFingerprint": {
    "id": "fp_a1b2c3d4"
  },
  "ip": "203.0.113.42",
  "metadata": {
    "fileName": "project.zip",
    "fileHash": "sha256_of_file_content",
    "fileSize": 1048576,
    "imageHash": "perceptual_hash_of_image",
    "projectName": "My SaaS App",
    "githubLink": "https://github.com/user/repo",
    "githubRepo": "user/repo",
    "query": "How to build a landing page",
    "sessionId": "ai_session_abc",
    "contentSnippet": "Some text the user pasted",
    "featureName": "code-editor"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | **Yes** | The user's ID in the client app |
| `activityType` | string | **Yes** | Type of activity (see table below) |
| `deviceFingerprint` | object | No | Device fingerprint (at minimum `{ id }`) |
| `ip` | string | No | Client IP address |
| `metadata` | object | No | Activity-specific data (see below) |

**Activity Types:**

| Type | When to Send |
|------|-------------|
| `ai_query` | User submits a query to AI |
| `file_upload` | User uploads a file |
| `file_download` | User downloads a file |
| `image_upload` | User uploads an image |
| `project_create` | User creates a new project |
| `project_open` | User opens an existing project |
| `github_link` | User pastes/references a GitHub URL |
| `login` | User logs in |
| `feature_use` | User uses a specific feature |
| `export` | User exports data |

**Metadata Fields:**

| Field | Used With | Description |
|-------|-----------|-------------|
| `fileHash` | `file_upload` | SHA-256 of the file content |
| `fileName` | `file_upload`, `image_upload` | Original file name |
| `fileSize` | `file_upload` | File size in bytes |
| `imageHash` | `image_upload` | Perceptual hash of the image |
| `projectName` | `project_create`, `project_open` | Name of the project |
| `githubLink` | `github_link` | Full GitHub URL |
| `githubRepo` | `github_link` | Repository in `owner/repo` format |
| `query` | `ai_query` | The AI query text |
| `sessionId` | `ai_query` | AI session grouping ID |
| `contentSnippet` | any | Text content for fingerprinting |
| `featureName` | `feature_use` | Name of the feature used |

#### Response

```json
{
  "matchScore": 0,
  "status": "OK",
  "signals": [],
  "contentReuse": [],
  "activityId": "act_uuid"
}
```

**When content reuse is detected:**

```json
{
  "matchScore": 75,
  "status": "REVOKE",
  "matchedUserId": "other_user_uuid",
  "signals": [
    {
      "module": "GRAPH",
      "signal": "CONTENT_REUSE_FILE",
      "severity": "CRITICAL",
      "description": "File \"project.zip\" was previously uploaded by another user",
      "value": 70
    }
  ],
  "contentReuse": [
    {
      "isReused": true,
      "originalUserId": "other_user_uuid",
      "contentType": "file_hash",
      "originalValue": "project.zip",
      "matchBoost": 70,
      "totalReuseCount": 1
    }
  ],
  "enforcement": {
    "action": "REVOKE",
    "reason": "Match score 75% exceeds threshold 60% (balanced mode)",
    "matchScore": 75,
    "threshold": 60,
    "matchedUserId": "other_user_uuid",
    "revokedAt": "2026-03-12T18:30:00.000Z"
  },
  "activityId": "act_uuid"
}
```

| Status | Meaning |
|--------|---------|
| `OK` | No issues detected |
| `WARN` | Approaching match threshold — monitor closely |
| `REVOKE` | Match threshold exceeded — user access is revoked |

---

### Settings

#### GET /settings

Returns the current sensitivity configuration for the authenticated API key.

#### Response

```json
{
  "sensitivity": "balanced",
  "matchThreshold": 60,
  "autoRevoke": true,
  "notifyWebhook": null,
  "monitorContent": true,
  "monitorAiUsage": true,
  "monitorGithub": true,
  "presets": {
    "strict": 30,
    "balanced": 60,
    "lenient": 85
  },
  "updatedAt": "2026-03-12T15:00:00.000Z"
}
```

#### PUT /settings

Updates the sensitivity configuration.

#### Request

```json
{
  "sensitivity": "strict",
  "autoRevoke": true,
  "notifyWebhook": "https://your-app.com/trialshield-webhook",
  "monitorContent": true,
  "monitorAiUsage": true,
  "monitorGithub": true
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `sensitivity` | string | `balanced` | `strict` \| `balanced` \| `lenient` \| `custom` |
| `matchThreshold` | number | Auto | 0-100, only required if `sensitivity` is `custom` |
| `autoRevoke` | boolean | `true` | Automatically revoke access on threshold breach |
| `notifyWebhook` | string | `null` | URL to POST when an enforcement action occurs |
| `monitorContent` | boolean | `true` | Track file/image/project fingerprints |
| `monitorAiUsage` | boolean | `true` | Track AI queries and sessions |
| `monitorGithub` | boolean | `true` | Track GitHub links and repos |

**Sensitivity Presets:**

| Preset | Threshold | Behavior |
|--------|-----------|----------|
| `strict` | ≥ 30% match | Aggressive — catches more abusers, higher false positive rate |
| `balanced` | ≥ 60% match | Recommended — good balance of accuracy and coverage |
| `lenient` | ≥ 85% match | Conservative — fewer false positives, may miss some abusers |
| `custom` | 0-100% | Set your own threshold via `matchThreshold` |

---

### POST /monitor

Post-signup monitoring for usage velocity and anomaly detection.

#### Request

```json
{
  "userId": "user_uuid",
  "eventType": "api_call",
  "metadata": {
    "endpoint": "/generate",
    "responseTime": 250
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | **Yes** | User ID to monitor |
| `eventType` | string | **Yes** | `api_call` \| `feature_use` \| `login` \| `data_export` \| `suspicious_action` |
| `metadata` | object | No | Additional context |

#### Response

```json
{
  "userId": "user_uuid",
  "usageVelocity": 5,
  "anomalyScore": 12,
  "isQuarantined": false,
  "action": "NONE"
}
```

| Action | Trigger |
|--------|---------|
| `NONE` | Normal usage |
| `WARN` | Anomaly score > 50 |
| `THROTTLE` | Usage velocity exceeds limit |
| `QUARANTINE` | Anomaly score >= 80 |
| `BLOCK` | User already quarantined |

---

### GET /stats

Returns dashboard statistics for all evaluations.

#### Response

```json
{
  "totalEvaluations": 1250,
  "evaluationsToday": 47,
  "allowRate": 72,
  "denyRate": 18,
  "challengeRate": 10,
  "avgRiskScore": 28.5,
  "allowCount": 900,
  "denyCount": 225,
  "challengeCount": 125,
  "recentEvaluations": [ ... ],
  "riskDistribution": [
    { "range": "0-20", "count": 450 },
    { "range": "20-40", "count": 280 },
    { "range": "40-60", "count": 190 },
    { "range": "60-80", "count": 180 },
    { "range": "80-100", "count": 150 }
  ]
}
```

---

### GET /audit

Returns audit logs for compliance.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Max records to return |
| `offset` | number | 0 | Pagination offset |
| `apiKeyId` | string | — | Filter by API key |
| `startDate` | string | — | ISO 8601 start date |
| `endDate` | string | — | ISO 8601 end date |

#### Response

```json
{
  "logs": [
    {
      "id": "log_uuid",
      "api_key_id": "key_uuid",
      "endpoint": "/api/v1/verify",
      "method": "POST",
      "response_decision": "ALLOW",
      "response_score": 25,
      "ip_address": "hashed_ip",
      "processing_time_ms": 342,
      "created_at": "2026-03-12T18:00:00.000Z"
    }
  ],
  "total": 1250,
  "limit": 50,
  "offset": 0
}
```

---

### POST /feedback

Submit feedback on a previous evaluation to improve future scoring.

#### Request

```json
{
  "evaluationId": "eval_uuid",
  "isAbuser": true,
  "notes": "User created 5 trial accounts with same device"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `evaluationId` | string | **Yes** | ID from a previous `/verify` response |
| `isAbuser` | boolean | **Yes** | Whether the user was confirmed as abuser |
| `notes` | string | No | Additional context |

---

### Keys

#### GET /keys

Returns all API keys (without the key value — only metadata).

```json
{
  "keys": [
    {
      "id": "key_uuid",
      "name": "Production Key",
      "rate_limit": 60,
      "is_active": true,
      "last_used": "2026-03-12T18:00:00.000Z",
      "total_requests": 5420,
      "created_at": "2026-03-01T00:00:00.000Z"
    }
  ]
}
```

#### POST /keys

Create a new API key.

```json
// Request
{ "name": "Production Key", "rateLimit": 120 }

// Response (201)
{
  "id": "key_uuid",
  "name": "Production Key",
  "key": "ts_a1b2c3d4e5f6...",
  "warning": "This is the only time the key will be shown. Store it securely.",
  "created_at": "2026-03-12T18:00:00.000Z"
}
```

> ⚠️ The `key` value is **only returned once** at creation. Store it securely.

#### DELETE /keys?id={key_uuid}

Deactivates an API key (soft delete).

```json
{ "success": true, "message": "API key deactivated" }
```

---

### Users

#### GET /users/:id?type=email

Export user data for compliance review.

| Parameter | Values | Description |
|-----------|--------|-------------|
| `type` | `email` \| `phone` | Type of identifier in `:id` |

#### DELETE /users/:id?type=user_id

GDPR/CCPA data deletion request. Removes all personal data associated with the identifier.

| Parameter | Values | Description |
|-----------|--------|-------------|
| `type` | `email` \| `phone` \| `user_id` | Type of identifier in `:id` |

```json
{
  "success": true,
  "deletedRecords": 12,
  "tables": ["ts_users", "ts_risk_events", "ts_device_graph"]
}
```

---

### GET /sdk

Serves the TrialShield client-side JavaScript SDK for embedding in web pages.

**Embed in HTML:**

```html
<script src="https://your-trialshield.com/api/v1/sdk?key=ts_your_key"></script>
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `key` | string | — | API key for auto-initialization |
| `auto` | string | `true` | Set to `false` to disable auto-init |

**No authentication required** for this endpoint. Served with:
- `Cache-Control: public, max-age=3600`
- `Access-Control-Allow-Origin: *`

---

### GET /health

System health check. **No authentication required.**

```json
{
  "status": "operational",
  "version": "1.0.0",
  "timestamp": "2026-03-12T18:00:00.000Z",
  "uptime": 86400.5,
  "database": "connected",
  "modules": {
    "emailIntelligence": true,
    "phoneIntelligence": true,
    "ipIntelligence": true,
    "deviceFingerprint": true,
    "behavioralAnalysis": true,
    "graphAnalysis": true,
    "riskScoring": true,
    "adaptiveChallenges": true,
    "postSignupMonitoring": true,
    "compliance": true
  },
  "disposableDomains": 32000,
  "externalApis": {
    "haveibeenpwned": true,
    "abuseipdb": true,
    "ipApi": true
  },
  "latency": "45ms"
}
```

---

## Risk Scoring Engine

The risk engine runs **6 analysis modules in parallel** and combines their scores using weighted averaging, then applies 15 cross-signal rules.

### Module Weights

| Module | Weight | Description |
|--------|--------|-------------|
| Email Intelligence | 0.20 | Disposable, catchall, breaches, MX records |
| Phone Intelligence | 0.10 | VOIP detection, carrier lookup, country risk |
| IP Intelligence | 0.25 | VPN/proxy/TOR, datacenter ASN, AbuseIPDB |
| Device Fingerprint | 0.20 | Headless browser, spoofing, automation detection |
| Behavioral Analysis | 0.10 | Signup velocity, bot score, session anomalies |
| Graph Analysis | 0.15 | Device/IP/email/phone/payment link clusters |

### Cross-Signal Rules (15 rules)

| # | Rule | Auto Score |
|---|------|-----------|
| 1 | Disposable email + VPN/Proxy | ≥ 88 |
| 2 | TOR + any critical signal | ≥ 95 |
| 3 | Multi-account device + velocity | ≥ 92 |
| 4 | Automation/headless browser | ≥ 82 |
| 5 | VOIP + Disposable email | ≥ 85 |
| 6 | Impossible travel detected | ≥ 72 |
| 7 | Coordinated attack / abuse network | ≥ 95 |
| 8 | Normalized email duplicate + evasion | ≥ 85 |
| 9 | Payment BIN reuse across trials | ≥ 78 |
| 10 | Phone reuse with new email | ≥ 70 |
| 11 | Datacenter IP + bot behavior | ≥ 88 |
| 12 | Residential proxy detected | ≥ 80 |
| 13 | Fingerprint spoofing + proxy | ≥ 90 |
| 14 | Triple threat: disposable+VOIP+VPN | ≥ 95 |
| 15 | 3+ critical signals from different modules | ≥ 92 |

### Adaptive Challenges

| Risk Tier | Score Range | Challenge |
|-----------|-----------|-----------|
| LOW | 0 – 30 | None |
| MEDIUM | 31 – 50 | Invisible CAPTCHA + Email verification |
| HIGH | 51 – 70 | Phone SMS verification + CAPTCHA |
| CRITICAL | 71 – 100 | Blocked + Manual review + Admin notification |

---

## Identity Resolution System

Every user signal becomes a persistent **identity anchor**. The system resolves identity on every API call.

### Anchor Types & Weights

| Anchor Type | Weight | Description |
|-------------|--------|-------------|
| `device` | 95% | Device fingerprint — near-certain identity match |
| `email` | 90% | Same email address |
| `phone` | 85% | Same phone number |
| `github_account` | 85% | Same GitHub account |
| `card_bin` | 80% | Same payment card BIN |
| `browser_fp` | 50% | Similar browser environment |
| `ip` | 40% | Same IP (lower weight — shared networks) |

### Match Score Formula

Uses **compound probability**: `matchScore = 1 - Π(1 - weight_i)`

**Example:**
- Device match (0.95) + Same file uploaded (0.70):
- `1 - (1 - 0.95) × (1 - 0.70) = 1 - 0.05 × 0.30 = 98.5%`

### Enforcement Flow

```
matchScore < threshold × 0.4  →  NONE
matchScore < threshold × 0.7  →  THROTTLE
matchScore < threshold        →  WARN
matchScore ≥ threshold         →  REVOKE (access cut, user quarantined)
```

---

## Content Fingerprinting

Every piece of content the user interacts with is hashed and compared across all users.

### Content Types & Weights

| Type | Weight | What Gets Hashed |
|------|--------|-----------------|
| `github_repo` | 80% | Normalized `owner/repo` |
| `github_link` | 75% | Normalized GitHub URL |
| `file_hash` | 70% | SHA-256 of file content |
| `image_hash` | 65% | Perceptual hash of image |
| `project_name` | 60% | Lowercased, trimmed project name |
| `ai_session` | 55% | Session ID (detects account sharing) |
| `url` | 50% | Normalized URL |
| `ai_query` | 45% | Normalized query (filler words removed) |
| `text_snippet` | 40% | Lowercase, whitespace-normalized text |

### Normalizations Applied

| Content | Normalization |
|---------|--------------|
| GitHub URLs | Remove protocol, www, trailing slashes, query params. Extract `owner/repo`. |
| AI queries | Lowercase, strip extra spaces, remove filler words ("please", "can you") |
| Project names | Lowercase, trim whitespace |
| Text snippets | Lowercase, collapse whitespace |

### Detectable Abuse Patterns

| Signal | Meaning |
|--------|---------|
| `CONTENT_REUSE_FILE` | Same file uploaded by different users |
| `CONTENT_REUSE_IMAGE` | Same image across accounts |
| `CONTENT_REUSE_PROJECT` | Same project name |
| `CONTENT_REUSE_GITHUB_LINK` | Same GitHub URL referenced |
| `CONTENT_REUSE_GITHUB_REPO` | Same repository linked |
| `CONTENT_REUSE_GITHUB_USER` | Same GitHub username extracted |
| `CONTENT_REUSE_AI_QUERY` | Similar AI query from different account |
| `CONTENT_REUSE_AI_SESSION` | Same session ID = account sharing |
| `CONTENT_REUSE_TEXT` | Same text pasted by different users |

---

## Analysis Modules

### Email Intelligence

| Check | Description |
|-------|-------------|
| Disposable domain detection | 32,000+ known disposable domains |
| Role-based prefix detection | admin@, info@, support@, etc. (26 prefixes) |
| MX record validation | Real-time DNS MX lookup |
| SPF/DMARC validation | DNS TXT record checks |
| Catch-all detection | SMTP RCPT TO probe |
| Breach history | HaveIBeenPwned API integration |
| Gmail dot trick detection | j.ohn.doe@gmail.com → johndoe@gmail.com |
| +alias detection | user+trial2@gmail.com → user@gmail.com |
| Domain age estimation | Heuristic via DNS SOA records |
| High-risk TLD flagging | .tk, .ml, .ga, .xyz, .top, .click, .buzz |

### Phone Intelligence

| Check | Description |
|-------|-------------|
| Format validation | libphonenumber-js validation |
| VOIP detection | Multi-API carrier lookup + VOIP provider database |
| Carrier identification | Real carrier name from lookup APIs |
| Country risk scoring | HIGH/MEDIUM/LOW risk country classification |
| Phone number reuse | Same phone across multiple accounts |

### IP Intelligence

| Check | Description |
|-------|-------------|
| Geolocation | ip-api.com (country, city, ISP, ASN) |
| VPN detection | ipapi.is deep VPN detection + ASN database |
| Proxy detection | ip-api.com proxy field + ASN check |
| TOR exit node check | Live TOR exit node list (refreshed hourly) |
| Datacenter ASN detection | 15+ known hosting ASN numbers |
| AbuseIPDB reputation | Confidence score + total abuse reports |
| Residential proxy detection | Org name matching against known providers |
| Impossible travel | Haversine distance vs time between logins |
| Hosting org detection | ISP name matching against cloud providers |

### Device Fingerprint Analysis

| Check | Description |
|-------|-------------|
| Headless browser detection | Puppeteer, Playwright, PhantomJS indicators |
| Automation detection | Selenium, WebDriver, navigator.webdriver |
| Fingerprint spoofing | Canvas/WebGL/Audio hash improbability |
| Impossible hardware combos | e.g., mobile platform + desktop resolution |
| Multi-account device | Device linked to 3+ user accounts |
| Browser similarity | Soft fingerprint clustering (TZ+resolution+language) |

### Behavioral Analysis

| Check | Description |
|-------|-------------|
| IP signup velocity | > 3 signups/hour from same IP |
| Device signup velocity | > 2 signups/day from same device |
| Email domain velocity | > 5 signups/hour from same email domain |
| Mouse entropy | Low entropy = bot-like movement |
| Keystroke uniformity | Too-consistent typing = automated input |
| Rapid form fill | Form completed in < 3 seconds |

### Graph Analysis

| Check | Description |
|-------|-------------|
| Device cluster | Same device across multiple accounts |
| IP cluster | Same IP across multiple accounts |
| Email domain cluster | Abnormal registrations from one domain |
| Normalized email links | Dot tricks + aliases linking to same base email |
| Phone reuse cluster | Same phone across accounts |
| Payment BIN cluster | Same card used for multiple trials |
| Browser similarity cluster | Near-identical browser environments |
| Coordinated attack detection | 3+ independent link types overlap |
| Abuse network classification | 5+ linked accounts with coordinated signals |

---

## Integration Guide

### Step 1: Get an API Key

```bash
curl -X POST https://your-trialshield.com/api/v1/keys \
  -H "X-API-Key: MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Production"}'
```

### Step 2: Configure Sensitivity

```bash
curl -X PUT https://your-trialshield.com/api/v1/settings \
  -H "X-API-Key: ts_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "sensitivity": "balanced",
    "autoRevoke": true,
    "notifyWebhook": "https://your-app.com/webhook/trialshield"
  }'
```

### Step 3: Embed the SDK (optional, for device fingerprinting)

```html
<script src="https://your-trialshield.com/api/v1/sdk?key=ts_your_key"></script>
```

### Step 4: Verify at Registration

```javascript
// Your backend — at user signup
const response = await fetch('https://your-trialshield.com/api/v1/verify', {
  method: 'POST',
  headers: {
    'X-API-Key': 'ts_your_key',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: user.email,
    phone: user.phone,
    ip: request.ip,
    deviceFingerprint: request.body.deviceFingerprint, // From SDK
  }),
});

const result = await response.json();

if (result.decision === 'DENY') {
  // Block registration
  return res.status(403).json({ error: 'Registration not allowed' });
}
if (result.decision === 'CHALLENGE') {
  // Show additional verification
  return res.json({ challenge: result.challenge });
}
// ALLOW — proceed with registration
```

### Step 5: Track Activity During Usage

```javascript
// Your backend — whenever the user does something
async function trackUserActivity(userId, activityType, metadata, req) {
  const response = await fetch('https://your-trialshield.com/api/v1/track', {
    method: 'POST',
    headers: {
      'X-API-Key': 'ts_your_key',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      activityType,
      ip: req.ip,
      metadata,
    }),
  });

  const result = await response.json();

  if (result.status === 'REVOKE') {
    // Cut access immediately
    await revokeUserSession(userId);
    return false;
  }

  return true;
}

// Examples:
await trackUserActivity(userId, 'file_upload', {
  fileHash: sha256(fileBuffer),
  fileName: file.name,
  fileSize: file.size,
}, req);

await trackUserActivity(userId, 'ai_query', {
  query: userQuery,
  sessionId: aiSessionId,
}, req);

await trackUserActivity(userId, 'github_link', {
  githubLink: 'https://github.com/user/repo',
  githubRepo: 'user/repo',
}, req);
```

### Step 6: Handle Webhook Notifications

TrialShield will POST to your webhook URL when an enforcement action occurs:

```json
{
  "event": "user_enforcement",
  "userId": "user_uuid",
  "action": "REVOKE",
  "reason": "Match score 95% exceeds threshold 60% (balanced mode)",
  "matchScore": 95,
  "threshold": 60,
  "matchedUserId": "original_user_uuid",
  "revokedAt": "2026-03-12T18:30:00.000Z",
  "timestamp": "2026-03-12T18:30:00.500Z"
}
```

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `ts_users` | Persistent user identities (hashed PII) |
| `ts_risk_events` | Every risk evaluation (scores, signals, enrichment) |
| `ts_device_graph` | Device-to-user associations |
| `ts_payment_fingerprints` | Card BIN tracking |
| `ts_api_keys` | API key management |
| `ts_audit_logs` | Compliance audit trail |
| `ts_rate_limits` | Rate limiting windows |
| `ts_velocity` | Signup velocity tracking |
| `ts_monitor_events` | Post-signup usage events |
| `ts_feedback` | Abuse confirmation feedback |

### v2 Continuous Monitoring Tables

| Table | Purpose |
|-------|---------|
| `ts_identity_anchors` | Device/email/phone/IP/card identity links |
| `ts_content_fingerprints` | File/image/GitHub/AI/project content hashes |
| `ts_activity_log` | User activity tracking with match scores |
| `ts_client_settings` | Per-client sensitivity configuration |

> All PII is stored as SHA-256 hashes. No plaintext email, phone, or IP is persisted.

---

## Error Codes

| HTTP Status | Code | Description |
|------------|------|-------------|
| 400 | `MISSING_INPUT` | Required fields not provided |
| 401 | — | Missing or invalid API key |
| 429 | — | Rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Server-side processing error |

---

## SDK Reference

The client-side SDK (`trialshield.js`) automatically collects:

| Category | Data Points |
|----------|------------|
| **Canvas** | Canvas rendering hash |
| **WebGL** | GPU renderer, vendor, parameters hash |
| **Audio** | AudioContext oscillator fingerprint |
| **Fonts** | Installed font detection |
| **Screen** | Resolution, color depth, pixel ratio |
| **Browser** | Timezone, language, platform, plugins |
| **Hardware** | CPU cores, device memory, touch support |
| **Behavior** | Mouse movement entropy, keystroke timing |
| **Detection** | Headless browser, automation, spoofing checks |

**Initialization:**

```javascript
// Auto-init (via script tag)
<script src="/api/v1/sdk?key=ts_your_key"></script>

// Manual init
const ts = new TrialShield({
  apiKey: 'ts_your_key',
  apiUrl: 'https://your-trialshield.com'
});

// Get fingerprint
const fingerprint = await ts.getFingerprint();

// Send with verification
const result = await ts.verify({
  email: 'user@example.com',
  phone: '+1234567890'
});
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side) |
| `TRIALSHIELD_MASTER_KEY` | Yes | Master API key for admin operations |
| `HIBP_API_KEY` | No | HaveIBeenPwned API key |
| `ABUSEIPDB_API_KEY` | No | AbuseIPDB API key |
| `IP_API_KEY` | No | ip-api.com pro API key |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | No | Default: 60 |
| `RATE_LIMIT_BURST` | No | Default: 10 |
