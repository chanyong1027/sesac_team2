-- Prompt Eval parallel execution state and lease fields

ALTER TABLE eval_runs
    ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS lease_owner VARCHAR(120),
    ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_eval_runs_status_created_claim
    ON eval_runs (status, created_at)
    WHERE status IN ('QUEUED', 'CLAIMED');

CREATE INDEX IF NOT EXISTS idx_eval_runs_status_lease_expires
    ON eval_runs (status, lease_expires_at)
    WHERE status IN ('CLAIMED', 'RUNNING', 'CANCEL_REQUESTED');
