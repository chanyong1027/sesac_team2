CREATE TABLE IF NOT EXISTS eval_release_criteria (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    min_pass_rate DOUBLE PRECISION NOT NULL DEFAULT 90,
    min_avg_overall_score DOUBLE PRECISION NOT NULL DEFAULT 75,
    max_error_rate DOUBLE PRECISION NOT NULL DEFAULT 10,
    min_improvement_notice_delta DOUBLE PRECISION NOT NULL DEFAULT 3,
    created_by BIGINT,
    updated_by BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_eval_release_criteria_workspace UNIQUE (workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_eval_release_criteria_workspace
    ON eval_release_criteria (workspace_id);
