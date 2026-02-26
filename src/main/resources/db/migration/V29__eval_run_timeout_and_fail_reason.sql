-- Add timeout and failure reason columns to eval_runs table
-- For Eval Worker Timeout (Phase 2) feature

-- timeout_at: Maximum execution time limit for the run
ALTER TABLE eval_runs
    ADD COLUMN IF NOT EXISTS timeout_at TIMESTAMPTZ;

-- fail_reason_code: Machine-readable failure reason code (e.g., 'RUN_TIMEOUT', 'CANCELLED')
ALTER TABLE eval_runs
    ADD COLUMN IF NOT EXISTS fail_reason_code VARCHAR(50);

-- fail_reason: Human-readable failure reason message
ALTER TABLE eval_runs
    ADD COLUMN IF NOT EXISTS fail_reason VARCHAR(500);

-- Create index for timeout recovery queries
CREATE INDEX IF NOT EXISTS idx_eval_runs_status_started_at
    ON eval_runs (status, started_at)
    WHERE status = 'RUNNING';
