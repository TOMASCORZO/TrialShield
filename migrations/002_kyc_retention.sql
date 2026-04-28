-- TrialShield — KYC sessions table + retention metadata
--
-- Creates the ts_kyc_sessions table (was missing from supabase-schema.sql) and
-- adds the purged_at column we need for the retention policy:
--   • Purge raw biometric blobs (selfie + document images) after 30 days.
--   • Keep cryptographic hashes + risk results indefinitely for fraud detection.
--
-- Idempotent — safe to run on a project that already had this table created
-- manually in the old environment.

CREATE TABLE IF NOT EXISTS ts_kyc_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID REFERENCES ts_api_keys(id) ON DELETE SET NULL,
    external_user_id TEXT,                       -- Identifier supplied by the client app
    status TEXT NOT NULL DEFAULT 'pending',      -- 'pending' | 'completed' | 'expired'
    verification_level TEXT NOT NULL DEFAULT 'document_face',  -- 'document_only' | 'document_face' | 'full'
    redirect_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Result blob (full risk analysis, signals, decision, score)
    result JSONB,

    -- Hashes (kept indefinitely for cross-tenant reuse detection)
    selfie_hash TEXT,
    document_front_hash TEXT,

    -- Raw biometric blobs (purged after retention window — see purged_at)
    selfie_data TEXT,
    document_front_data TEXT,

    -- Device fingerprint snapshot taken at submission time
    device_info JSONB,

    -- Lifecycle timestamps
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Indexes used by hot-path queries
CREATE INDEX IF NOT EXISTS idx_kyc_sessions_api_key
    ON ts_kyc_sessions(api_key_id);
CREATE INDEX IF NOT EXISTS idx_kyc_sessions_external_user
    ON ts_kyc_sessions(external_user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_sessions_doc_hash
    ON ts_kyc_sessions(document_front_hash)
    WHERE document_front_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kyc_sessions_selfie_hash
    ON ts_kyc_sessions(selfie_hash)
    WHERE selfie_hash IS NOT NULL;

-- Retention metadata
ALTER TABLE ts_kyc_sessions ADD COLUMN IF NOT EXISTS purged_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_kyc_sessions_purge_candidate
    ON ts_kyc_sessions(completed_at)
    WHERE purged_at IS NULL AND completed_at IS NOT NULL;
