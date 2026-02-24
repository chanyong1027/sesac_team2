CREATE TABLE IF NOT EXISTS eval_release_criteria_audits (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    eval_release_criteria_id BIGINT,
    min_pass_rate DOUBLE PRECISION NOT NULL,
    min_avg_overall_score DOUBLE PRECISION NOT NULL,
    max_error_rate DOUBLE PRECISION NOT NULL,
    min_improvement_notice_delta DOUBLE PRECISION NOT NULL,
    changed_by BIGINT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_eval_release_criteria_audits_criteria
        FOREIGN KEY (eval_release_criteria_id) REFERENCES eval_release_criteria(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_eval_release_criteria_audits_workspace_changed_at
    ON eval_release_criteria_audits (workspace_id, changed_at DESC);
