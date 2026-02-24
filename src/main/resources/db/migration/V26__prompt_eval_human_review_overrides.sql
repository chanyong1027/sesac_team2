-- Add human review columns to eval_case_results
ALTER TABLE eval_case_results
    ADD COLUMN IF NOT EXISTS human_review_verdict VARCHAR(20) NOT NULL DEFAULT 'UNREVIEWED',
    ADD COLUMN IF NOT EXISTS human_override_pass BOOLEAN,
    ADD COLUMN IF NOT EXISTS human_review_comment TEXT,
    ADD COLUMN IF NOT EXISTS human_review_category VARCHAR(50),
    ADD COLUMN IF NOT EXISTS human_reviewed_by BIGINT,
    ADD COLUMN IF NOT EXISTS human_reviewed_at TIMESTAMPTZ;

-- Add FK constraint for human_reviewed_by
ALTER TABLE eval_case_results
    DROP CONSTRAINT IF EXISTS fk_eval_case_results_human_reviewed_by,
    ADD CONSTRAINT fk_eval_case_results_human_reviewed_by
        FOREIGN KEY (human_reviewed_by) REFERENCES console_user(id) ON DELETE SET NULL;

-- Add indexes for human review queries
CREATE INDEX IF NOT EXISTS idx_eval_case_results_run_verdict
    ON eval_case_results (eval_run_id, human_review_verdict);

CREATE INDEX IF NOT EXISTS idx_eval_case_results_run_reviewed_at
    ON eval_case_results (eval_run_id, human_reviewed_at DESC);

-- Create audit table for human review changes
CREATE TABLE IF NOT EXISTS eval_case_result_human_review_audits (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    eval_run_id BIGINT NOT NULL,
    eval_case_result_id BIGINT NOT NULL,
    review_verdict VARCHAR(20) NOT NULL,
    override_pass BOOLEAN,
    comment TEXT,
    category VARCHAR(50),
    request_id VARCHAR(120),
    changed_by BIGINT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK constraints for audit table
ALTER TABLE eval_case_result_human_review_audits
    DROP CONSTRAINT IF EXISTS fk_eval_case_result_human_review_audits_case_result,
    ADD CONSTRAINT fk_eval_case_result_human_review_audits_case_result
        FOREIGN KEY (eval_case_result_id) REFERENCES eval_case_results(id) ON DELETE CASCADE;

ALTER TABLE eval_case_result_human_review_audits
    DROP CONSTRAINT IF EXISTS fk_eval_case_result_human_review_audits_eval_run,
    ADD CONSTRAINT fk_eval_case_result_human_review_audits_eval_run
        FOREIGN KEY (eval_run_id) REFERENCES eval_runs(id) ON DELETE CASCADE;

ALTER TABLE eval_case_result_human_review_audits
    DROP CONSTRAINT IF EXISTS fk_eval_case_result_human_review_audits_changed_by,
    ADD CONSTRAINT fk_eval_case_result_human_review_audits_changed_by
        FOREIGN KEY (changed_by) REFERENCES console_user(id) ON DELETE SET NULL;

-- Add indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_eval_case_result_human_review_audits_workspace_changed_at
    ON eval_case_result_human_review_audits (workspace_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_eval_case_result_human_review_audits_case_result_changed_at
    ON eval_case_result_human_review_audits (eval_case_result_id, changed_at DESC);

-- Idempotency uniqueness index for (eval_case_result_id, request_id)
CREATE UNIQUE INDEX IF NOT EXISTS uq_eval_case_result_human_review_audits_case_request
    ON eval_case_result_human_review_audits (eval_case_result_id, request_id)
    WHERE request_id IS NOT NULL;
