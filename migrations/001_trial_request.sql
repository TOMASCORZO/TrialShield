-- TrialShield — Trial request workflow
-- Run in Supabase SQL editor before deploying the paywall.
-- Adds the columns needed to track trial requests that require admin approval.

ALTER TABLE ts_api_keys ADD COLUMN IF NOT EXISTS trial_requested_at TIMESTAMPTZ;
ALTER TABLE ts_api_keys ADD COLUMN IF NOT EXISTS trial_approved_at TIMESTAMPTZ;
ALTER TABLE ts_api_keys ADD COLUMN IF NOT EXISTS trial_rejected_at TIMESTAMPTZ;
ALTER TABLE ts_api_keys ADD COLUMN IF NOT EXISTS trial_request_note TEXT;

CREATE INDEX IF NOT EXISTS idx_api_keys_trial_requested
    ON ts_api_keys(trial_requested_at)
    WHERE trial_requested_at IS NOT NULL AND trial_approved_at IS NULL;
