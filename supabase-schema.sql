-- ═══════════════════════════════════════════════════════════════
-- TrialShield — Complete Supabase Schema + v3 Migration
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════
-- SECTION 1: CORE TABLES
-- ═══════════════════════════════════════════════════════════════

-- Users evaluated by TrialShield
CREATE TABLE IF NOT EXISTS ts_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash TEXT,
  phone_hash TEXT,
  normalized_email_hash TEXT,
  email_domain_hash TEXT,
  account_status TEXT DEFAULT 'trial_active',  -- 'trial_active' | 'trial_expired' | 'paid'
  trial_expires_at TIMESTAMPTZ,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  total_evaluations INTEGER DEFAULT 1,
  highest_risk_score INTEGER DEFAULT 0,
  last_decision TEXT DEFAULT 'ALLOW',
  is_quarantined BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Risk evaluation events
CREATE TABLE IF NOT EXISTS ts_risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES ts_users(id),
  decision TEXT NOT NULL,
  risk_score INTEGER NOT NULL,
  email_score INTEGER DEFAULT 0,
  phone_score INTEGER DEFAULT 0,
  ip_score INTEGER DEFAULT 0,
  device_score INTEGER DEFAULT 0,
  behavior_score INTEGER DEFAULT 0,
  graph_score INTEGER DEFAULT 0,
  signals JSONB DEFAULT '[]',
  enrichment JSONB DEFAULT '{}',
  ip_address TEXT,
  device_fingerprint_id TEXT,
  processing_time_ms INTEGER,
  api_key_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Device graph for linking devices to accounts
CREATE TABLE IF NOT EXISTS ts_device_graph (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_fingerprint_id TEXT NOT NULL,
  user_id UUID REFERENCES ts_users(id),
  ip_address TEXT,
  user_agent TEXT,
  soft_fingerprint TEXT,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  times_seen INTEGER DEFAULT 1
);

-- Payment fingerprints for card BIN + Stripe fingerprint tracking
CREATE TABLE IF NOT EXISTS ts_payment_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES ts_users(id) NOT NULL,
  bin_hash TEXT NOT NULL,
  card_fingerprint_hash TEXT,             -- Stripe card fingerprint (strongest signal)
  last4 TEXT,
  brand TEXT,                             -- visa, mastercard, amex, etc.
  card_country TEXT,                      -- Card issuing country (ISO)
  funding_type TEXT,                      -- credit, debit, prepaid
  cvc_check TEXT,                         -- pass, fail, unavailable
  avs_check TEXT,                         -- pass, fail, unavailable
  stripe_risk_level TEXT,                 -- normal, elevated, highest
  stripe_risk_score INTEGER,              -- Stripe Radar 0-100
  billing_zip_hash TEXT,
  billing_country TEXT,
  stripe_customer_id TEXT,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, bin_hash)
);

-- API keys for clients
CREATE TABLE IF NOT EXISTS ts_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  hashed_key TEXT NOT NULL UNIQUE,
  rate_limit INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT TRUE,
  last_used TIMESTAMPTZ,
  total_requests INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs for compliance
CREATE TABLE IF NOT EXISTS ts_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id TEXT,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  request_body JSONB DEFAULT '{}',
  response_decision TEXT,
  response_score INTEGER,
  ip_address TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate limiting tracking
CREATE TABLE IF NOT EXISTS ts_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id TEXT,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER DEFAULT 1,
  UNIQUE(api_key_id, window_start)
);

-- Velocity tracking for signup/login patterns
CREATE TABLE IF NOT EXISTS ts_velocity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier_type TEXT NOT NULL,
  identifier_value TEXT NOT NULL,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Post-signup monitoring events
CREATE TABLE IF NOT EXISTS ts_monitor_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback for model training
CREATE TABLE IF NOT EXISTS ts_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID REFERENCES ts_risk_events(id),
  is_abuser BOOLEAN NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 2: CONTINUOUS MONITORING TABLES (v2)
-- ═══════════════════════════════════════════════════════════════

-- Identity anchors: every signal that links to a user identity
CREATE TABLE IF NOT EXISTS ts_identity_anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES ts_users(id) NOT NULL,
  anchor_type TEXT NOT NULL,
  anchor_hash TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  times_seen INTEGER DEFAULT 1,
  UNIQUE(user_id, anchor_type, anchor_hash)
);

-- Content fingerprints: hashes of files, images, projects, links, AI sessions
CREATE TABLE IF NOT EXISTS ts_content_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES ts_users(id) NOT NULL,
  content_type TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  api_key_id TEXT,
  original_value TEXT,
  file_size BIGINT,
  metadata JSONB DEFAULT '{}',
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  times_seen INTEGER DEFAULT 1
);

-- User activity log
CREATE TABLE IF NOT EXISTS ts_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES ts_users(id) NOT NULL,
  api_key_id TEXT,
  activity_type TEXT NOT NULL,
  activity_hash TEXT,
  content_fingerprint_id UUID REFERENCES ts_content_fingerprints(id),
  match_score_at_time REAL,
  enforcement_action TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  device_fingerprint_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client settings: per-API-key sensitivity config
CREATE TABLE IF NOT EXISTS ts_client_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id TEXT NOT NULL UNIQUE,
  sensitivity TEXT DEFAULT 'balanced',
  match_threshold INTEGER DEFAULT 60,
  auto_revoke BOOLEAN DEFAULT TRUE,
  notify_webhook TEXT,
  monitor_content BOOLEAN DEFAULT TRUE,
  monitor_ai_usage BOOLEAN DEFAULT TRUE,
  monitor_github BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 3: INDEXES
-- ═══════════════════════════════════════════════════════════════

-- Core table indexes
CREATE INDEX IF NOT EXISTS idx_users_email_hash ON ts_users(email_hash);
CREATE INDEX IF NOT EXISTS idx_users_phone_hash ON ts_users(phone_hash);
CREATE INDEX IF NOT EXISTS idx_users_normalized_email ON ts_users(normalized_email_hash);
CREATE INDEX IF NOT EXISTS idx_users_email_domain ON ts_users(email_domain_hash);
CREATE INDEX IF NOT EXISTS idx_risk_events_user ON ts_risk_events(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_created ON ts_risk_events(created_at);
CREATE INDEX IF NOT EXISTS idx_risk_events_ip ON ts_risk_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_device_graph_fp ON ts_device_graph(device_fingerprint_id);
CREATE INDEX IF NOT EXISTS idx_device_graph_user ON ts_device_graph(user_id);
CREATE INDEX IF NOT EXISTS idx_device_graph_soft ON ts_device_graph(soft_fingerprint);
CREATE INDEX IF NOT EXISTS idx_payment_bin ON ts_payment_fingerprints(bin_hash);
CREATE INDEX IF NOT EXISTS idx_payment_user ON ts_payment_fingerprints(user_id);
CREATE INDEX IF NOT EXISTS idx_velocity_identifier ON ts_velocity(identifier_type, identifier_value);
CREATE INDEX IF NOT EXISTS idx_velocity_created ON ts_velocity(created_at);
CREATE INDEX IF NOT EXISTS idx_monitor_user ON ts_monitor_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON ts_audit_logs(created_at);

-- v2 table indexes
CREATE INDEX IF NOT EXISTS idx_identity_anchor_hash ON ts_identity_anchors(anchor_hash);
CREATE INDEX IF NOT EXISTS idx_identity_anchor_user ON ts_identity_anchors(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_anchor_type ON ts_identity_anchors(anchor_type, anchor_hash);
CREATE INDEX IF NOT EXISTS idx_content_fp_hash ON ts_content_fingerprints(content_hash);
CREATE INDEX IF NOT EXISTS idx_content_fp_user ON ts_content_fingerprints(user_id);
CREATE INDEX IF NOT EXISTS idx_content_fp_type ON ts_content_fingerprints(content_type, content_hash);
CREATE INDEX IF NOT EXISTS idx_activity_user ON ts_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_type ON ts_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_created ON ts_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_client_settings_key ON ts_client_settings(api_key_id);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 4: v3 MIGRATION (run if upgrading from v2)
-- Safe to run multiple times — uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE ts_users ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'trial_active';
ALTER TABLE ts_users ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_account_status ON ts_users(account_status);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 5: OAuth Proxy Tables (v3)
-- ═══════════════════════════════════════════════════════════════

-- OAuth provider configs per API key
CREATE TABLE IF NOT EXISTS ts_oauth_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id TEXT NOT NULL,
  provider TEXT NOT NULL,             -- 'google' | 'github'
  client_id TEXT NOT NULL,
  client_secret_encrypted TEXT,       -- SHA-256 hash for lookup
  client_secret_raw TEXT NOT NULL,    -- Stored encrypted at rest by Supabase
  redirect_uri TEXT NOT NULL,         -- Client's redirect URI after OAuth
  scopes JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(api_key_id, provider)
);

-- OAuth CSRF sessions (short-lived, auto-cleaned)
CREATE TABLE IF NOT EXISTS ts_oauth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  api_key_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  client_state TEXT DEFAULT '',        -- Passthrough state from client
  ip_address TEXT,
  device_fingerprint_hint TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Indexes for OAuth tables
CREATE INDEX IF NOT EXISTS idx_oauth_config_key ON ts_oauth_configs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_oauth_config_provider ON ts_oauth_configs(api_key_id, provider);
CREATE INDEX IF NOT EXISTS idx_oauth_session_id ON ts_oauth_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_oauth_session_expires ON ts_oauth_sessions(expires_at);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 6: Stripe Integration Tables
-- ═══════════════════════════════════════════════════════════════

-- Stripe webhook configs per API key
CREATE TABLE IF NOT EXISTS ts_stripe_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id TEXT NOT NULL UNIQUE,
  webhook_secret_raw TEXT NOT NULL,
  webhook_secret_hash TEXT,
  stripe_api_key_raw TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  events_listening JSONB DEFAULT '[]',
  total_events_received INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Raw Stripe event log for audit + replay
CREATE TABLE IF NOT EXISTS ts_stripe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  stripe_event_id TEXT,
  user_id UUID REFERENCES ts_users(id),
  card_fingerprint_hash TEXT,
  risk_score INTEGER,
  signals JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Stripe tables
CREATE INDEX IF NOT EXISTS idx_stripe_config_key ON ts_stripe_configs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_stripe_event_key ON ts_stripe_events(api_key_id);
CREATE INDEX IF NOT EXISTS idx_stripe_event_type ON ts_stripe_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_event_user ON ts_stripe_events(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_event_fp ON ts_stripe_events(card_fingerprint_hash);
-- v3 migration: add new columns to existing payment fingerprints table
ALTER TABLE ts_payment_fingerprints ADD COLUMN IF NOT EXISTS card_fingerprint_hash TEXT;
ALTER TABLE ts_payment_fingerprints ADD COLUMN IF NOT EXISTS last4 TEXT;
ALTER TABLE ts_payment_fingerprints ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE ts_payment_fingerprints ADD COLUMN IF NOT EXISTS card_country TEXT;
ALTER TABLE ts_payment_fingerprints ADD COLUMN IF NOT EXISTS funding_type TEXT;
ALTER TABLE ts_payment_fingerprints ADD COLUMN IF NOT EXISTS cvc_check TEXT;
ALTER TABLE ts_payment_fingerprints ADD COLUMN IF NOT EXISTS avs_check TEXT;
ALTER TABLE ts_payment_fingerprints ADD COLUMN IF NOT EXISTS stripe_risk_level TEXT;
ALTER TABLE ts_payment_fingerprints ADD COLUMN IF NOT EXISTS stripe_risk_score INTEGER;
ALTER TABLE ts_payment_fingerprints ADD COLUMN IF NOT EXISTS billing_zip_hash TEXT;
ALTER TABLE ts_payment_fingerprints ADD COLUMN IF NOT EXISTS billing_country TEXT;
ALTER TABLE ts_payment_fingerprints ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_payment_card_fp ON ts_payment_fingerprints(card_fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_payment_funding ON ts_payment_fingerprints(funding_type);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 7: Multi-Tenancy (Client Isolation)
-- ═══════════════════════════════════════════════════════════════

-- Add api_key_id to core tables for client isolation
ALTER TABLE ts_users ADD COLUMN IF NOT EXISTS api_key_id TEXT;
ALTER TABLE ts_identity_anchors ADD COLUMN IF NOT EXISTS api_key_id TEXT;
ALTER TABLE ts_payment_fingerprints ADD COLUMN IF NOT EXISTS api_key_id TEXT;

-- Indexes for multi-tenancy scoping
CREATE INDEX IF NOT EXISTS idx_users_api_key ON ts_users(api_key_id);
ALTER TABLE ts_content_fingerprints ADD COLUMN IF NOT EXISTS api_key_id TEXT;
CREATE INDEX IF NOT EXISTS idx_content_fp_api_key ON ts_content_fingerprints(api_key_id);

CREATE INDEX IF NOT EXISTS idx_anchors_api_key ON ts_identity_anchors(api_key_id);
CREATE INDEX IF NOT EXISTS idx_payment_fp_api_key ON ts_payment_fingerprints(api_key_id);

ALTER TABLE ts_activity_log ADD COLUMN IF NOT EXISTS api_key_id TEXT;
ALTER TABLE ts_risk_events ADD COLUMN IF NOT EXISTS api_key_id TEXT;
ALTER TABLE ts_risk_events DROP CONSTRAINT IF EXISTS ts_risk_events_api_key_id_fkey;
ALTER TABLE ts_risk_events ALTER COLUMN api_key_id TYPE TEXT;

ALTER TABLE ts_device_graph ADD COLUMN IF NOT EXISTS api_key_id TEXT;
ALTER TABLE ts_device_graph DROP CONSTRAINT IF EXISTS ts_device_graph_api_key_id_fkey;
ALTER TABLE ts_device_graph ALTER COLUMN api_key_id TYPE TEXT;

ALTER TABLE ts_audit_logs ADD COLUMN IF NOT EXISTS api_key_id TEXT;
ALTER TABLE ts_audit_logs DROP CONSTRAINT IF EXISTS ts_audit_logs_api_key_id_fkey;
ALTER TABLE ts_audit_logs ALTER COLUMN api_key_id TYPE TEXT;

ALTER TABLE ts_rate_limits ADD COLUMN IF NOT EXISTS api_key_id TEXT;
ALTER TABLE ts_rate_limits DROP CONSTRAINT IF EXISTS ts_rate_limits_api_key_id_fkey;
ALTER TABLE ts_rate_limits ALTER COLUMN api_key_id TYPE TEXT;


-- ═══════════════════════════════════════════════════════════════
-- SECTION 8: API Key Subscription & Billing
-- ═══════════════════════════════════════════════════════════════

-- Subscription fields on api keys
ALTER TABLE ts_api_keys ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE ts_api_keys ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'pending';
ALTER TABLE ts_api_keys ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'pending';
ALTER TABLE ts_api_keys ADD COLUMN IF NOT EXISTS polar_customer_id TEXT;
ALTER TABLE ts_api_keys ADD COLUMN IF NOT EXISTS polar_subscription_id TEXT;
ALTER TABLE ts_api_keys ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_api_keys_polar ON ts_api_keys(polar_customer_id);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 9: Polar.sh Integration Tables
-- ═══════════════════════════════════════════════════════════════

-- Polar.sh global webhook config
CREATE TABLE IF NOT EXISTS ts_polar_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_secret TEXT NOT NULL,
  org_access_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Polar.sh customer records (linked to API keys)
CREATE TABLE IF NOT EXISTS ts_polar_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  polar_customer_id TEXT NOT NULL UNIQUE,
  polar_subscription_id TEXT,
  email TEXT,
  name TEXT,
  plan TEXT DEFAULT 'starter',
  status TEXT DEFAULT 'active',
  product_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Polar.sh payment history
CREATE TABLE IF NOT EXISTS ts_polar_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  polar_customer_id TEXT NOT NULL,
  polar_order_id TEXT,
  amount INTEGER,
  currency TEXT DEFAULT 'usd',
  status TEXT,
  product_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Polar tables
CREATE INDEX IF NOT EXISTS idx_polar_customer ON ts_polar_customers(polar_customer_id);
CREATE INDEX IF NOT EXISTS idx_polar_payment_customer ON ts_polar_payments(polar_customer_id);


-- ═══════════════════════════════════════════════════════════════
-- SECTION 10: KYC Sessions
-- ═══════════════════════════════════════════════════════════════
-- Stores each verification session (document + selfie + risk result).
-- Raw biometric blobs are purged after the retention window — see migrations/002.

CREATE TABLE IF NOT EXISTS ts_kyc_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID REFERENCES ts_api_keys(id) ON DELETE SET NULL,
    external_user_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    verification_level TEXT NOT NULL DEFAULT 'document_face',
    redirect_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    result JSONB,
    selfie_hash TEXT,
    document_front_hash TEXT,
    selfie_data TEXT,
    document_front_data TEXT,
    device_info JSONB,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kyc_sessions_api_key ON ts_kyc_sessions(api_key_id);
CREATE INDEX IF NOT EXISTS idx_kyc_sessions_external_user ON ts_kyc_sessions(external_user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_sessions_doc_hash
    ON ts_kyc_sessions(document_front_hash)
    WHERE document_front_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kyc_sessions_selfie_hash
    ON ts_kyc_sessions(selfie_hash)
    WHERE selfie_hash IS NOT NULL;
