import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseUrl(): string {
    return process.env.NEXT_PUBLIC_SUPABASE_URL || '';
}

// Client for browser-side operations
export const supabase = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        if (!_supabase) {
            _supabase = createClient(getSupabaseUrl(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
        }
        return (_supabase as any)[prop];
    }
});

// Admin client for server-side operations (bypasses RLS)
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        if (!_supabaseAdmin) {
            _supabaseAdmin = createClient(getSupabaseUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY || '');
        }
        return (_supabaseAdmin as any)[prop];
    }
});

// ─── Database Schema SQL (HARDENED) ──────────────────────────
// Run this in your Supabase SQL Editor to create the tables:
export const SCHEMA_SQL = `
-- Users evaluated by TrialShield
CREATE TABLE IF NOT EXISTS ts_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash TEXT,
  phone_hash TEXT,
  normalized_email_hash TEXT,          -- KEY: catches dot tricks + aliases
  email_domain_hash TEXT,              -- For domain cluster analysis
  account_status TEXT DEFAULT 'trial_active', -- 'trial_active' | 'trial_expired' | 'paid'
  trial_expires_at TIMESTAMPTZ,        -- When the free trial ends
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
  soft_fingerprint TEXT,               -- HARDENED: browser similarity hash (TZ+resolution+lang)
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  times_seen INTEGER DEFAULT 1
);

-- Payment fingerprints for card BIN tracking
CREATE TABLE IF NOT EXISTS ts_payment_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES ts_users(id) NOT NULL,
  bin_hash TEXT NOT NULL,              -- First 6-8 digits of card, hashed
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
  api_key_id UUID REFERENCES ts_api_keys(id),
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
  api_key_id UUID REFERENCES ts_api_keys(id),
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

-- ─── Indexes for performance ─────────────────────────────────
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

-- ═══════════════════════════════════════════════════════════════
-- CONTINUOUS MONITORING TABLES (v2)
-- ═══════════════════════════════════════════════════════════════

-- Identity anchors: every signal that links to a user identity
CREATE TABLE IF NOT EXISTS ts_identity_anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES ts_users(id) NOT NULL,
  anchor_type TEXT NOT NULL,        -- 'device' | 'ip' | 'email' | 'phone' | 'card_bin' | 'browser_fp' | 'github_account'
  anchor_hash TEXT NOT NULL,        -- SHA-256 of the anchor value
  confidence REAL DEFAULT 1.0,      -- 0.0 - 1.0 how sure we are this anchor belongs to this user
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  times_seen INTEGER DEFAULT 1,
  UNIQUE(user_id, anchor_type, anchor_hash)
);

-- Content fingerprints: hashes of files, images, projects, links, AI sessions
CREATE TABLE IF NOT EXISTS ts_content_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES ts_users(id) NOT NULL,
  content_type TEXT NOT NULL,       -- 'file_hash' | 'image_hash' | 'project_name' | 'github_link' | 'github_repo' | 'ai_session' | 'ai_query' | 'text_snippet' | 'url'
  content_hash TEXT NOT NULL,       -- SHA-256 of the content
  original_value TEXT,              -- Original filename, project name, URL (for display in dashboard)
  file_size BIGINT,
  metadata JSONB DEFAULT '{}',     -- Extra data (file extension, image dimensions, etc.)
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  times_seen INTEGER DEFAULT 1
);

-- User activity log: every action tracked in the client app
CREATE TABLE IF NOT EXISTS ts_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES ts_users(id) NOT NULL,
  api_key_id TEXT,
  activity_type TEXT NOT NULL,      -- 'ai_query' | 'file_upload' | 'file_download' | 'project_create' | 'project_open' | 'github_link' | 'image_upload' | 'login' | 'feature_use' | 'export'
  activity_hash TEXT,               -- Hash of the activity content (for deduplication)
  content_fingerprint_id UUID REFERENCES ts_content_fingerprints(id),
  match_score_at_time REAL,         -- Match score at the time of this activity
  enforcement_action TEXT,          -- 'NONE' | 'WARN' | 'REVOKE' — what we did
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  device_fingerprint_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client settings: per-API-key sensitivity config
CREATE TABLE IF NOT EXISTS ts_client_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id TEXT NOT NULL UNIQUE,
  sensitivity TEXT DEFAULT 'balanced',    -- 'strict' | 'balanced' | 'lenient' | 'custom'
  match_threshold INTEGER DEFAULT 60,     -- 0-100 percentage
  auto_revoke BOOLEAN DEFAULT TRUE,
  notify_webhook TEXT,                    -- Webhook URL for revocation events
  monitor_content BOOLEAN DEFAULT TRUE,
  monitor_ai_usage BOOLEAN DEFAULT TRUE,
  monitor_github BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes for v2 tables ───────────────────────────────────
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

-- ─── Automatic cleanup of old velocity data ──────────────────
-- Create a cron job (via pg_cron or Supabase scheduled function) to run:
-- DELETE FROM ts_velocity WHERE created_at < NOW() - INTERVAL '7 days';
`;
