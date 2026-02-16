CREATE TABLE IF NOT EXISTS eval_datasets (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(1000),
    created_by BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_eval_datasets_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE,
    CONSTRAINT fk_eval_datasets_created_by FOREIGN KEY (created_by) REFERENCES console_user (id)
);

CREATE INDEX IF NOT EXISTS idx_eval_datasets_workspace_id ON eval_datasets (workspace_id);

CREATE TABLE IF NOT EXISTS eval_test_cases (
    id BIGSERIAL PRIMARY KEY,
    dataset_id BIGINT NOT NULL,
    case_order INTEGER NOT NULL,
    external_id VARCHAR(120),
    input_text TEXT NOT NULL,
    context_json JSONB,
    expected_json JSONB,
    constraints_json JSONB,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_eval_test_cases_dataset FOREIGN KEY (dataset_id) REFERENCES eval_datasets (id) ON DELETE CASCADE,
    CONSTRAINT uq_eval_test_cases_dataset_order UNIQUE (dataset_id, case_order)
);

CREATE INDEX IF NOT EXISTS idx_eval_test_cases_dataset_id ON eval_test_cases (dataset_id);

CREATE TABLE IF NOT EXISTS prompt_eval_defaults (
    id BIGSERIAL PRIMARY KEY,
    prompt_id BIGINT NOT NULL UNIQUE,
    dataset_id BIGINT,
    rubric_template_code VARCHAR(50) NOT NULL,
    rubric_overrides_json JSONB,
    default_mode VARCHAR(30) NOT NULL,
    auto_eval_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_prompt_eval_defaults_prompt FOREIGN KEY (prompt_id) REFERENCES prompts (id) ON DELETE CASCADE,
    CONSTRAINT fk_prompt_eval_defaults_dataset FOREIGN KEY (dataset_id) REFERENCES eval_datasets (id) ON DELETE SET NULL,
    CONSTRAINT fk_prompt_eval_defaults_updated_by FOREIGN KEY (updated_by) REFERENCES console_user (id)
);

CREATE TABLE IF NOT EXISTS eval_runs (
    id BIGSERIAL PRIMARY KEY,
    prompt_id BIGINT NOT NULL,
    prompt_version_id BIGINT NOT NULL,
    workspace_id BIGINT NOT NULL,
    dataset_id BIGINT NOT NULL,
    mode VARCHAR(30) NOT NULL,
    trigger_type VARCHAR(30) NOT NULL,
    rubric_template_code VARCHAR(50) NOT NULL,
    rubric_overrides_json JSONB,
    candidate_provider VARCHAR(50),
    candidate_model VARCHAR(120),
    judge_provider VARCHAR(50),
    judge_model VARCHAR(120),
    status VARCHAR(20) NOT NULL,
    total_cases INTEGER NOT NULL DEFAULT 0,
    processed_cases INTEGER NOT NULL DEFAULT 0,
    passed_cases INTEGER NOT NULL DEFAULT 0,
    failed_cases INTEGER NOT NULL DEFAULT 0,
    error_cases INTEGER NOT NULL DEFAULT 0,
    summary_json JSONB,
    cost_json JSONB,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_eval_runs_prompt FOREIGN KEY (prompt_id) REFERENCES prompts (id) ON DELETE CASCADE,
    CONSTRAINT fk_eval_runs_prompt_version FOREIGN KEY (prompt_version_id) REFERENCES prompt_versions (id),
    CONSTRAINT fk_eval_runs_dataset FOREIGN KEY (dataset_id) REFERENCES eval_datasets (id),
    CONSTRAINT fk_eval_runs_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE,
    CONSTRAINT fk_eval_runs_created_by FOREIGN KEY (created_by) REFERENCES console_user (id)
);

CREATE INDEX IF NOT EXISTS idx_eval_runs_prompt_id ON eval_runs (prompt_id);
CREATE INDEX IF NOT EXISTS idx_eval_runs_status_created_at ON eval_runs (status, created_at);

CREATE TABLE IF NOT EXISTS eval_case_results (
    id BIGSERIAL PRIMARY KEY,
    eval_run_id BIGINT NOT NULL,
    test_case_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    candidate_output_text TEXT,
    baseline_output_text TEXT,
    candidate_meta_json JSONB,
    baseline_meta_json JSONB,
    rule_checks_json JSONB,
    judge_output_json JSONB,
    overall_score DOUBLE PRECISION,
    pass BOOLEAN,
    error_code VARCHAR(120),
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_eval_case_results_eval_run FOREIGN KEY (eval_run_id) REFERENCES eval_runs (id) ON DELETE CASCADE,
    CONSTRAINT fk_eval_case_results_test_case FOREIGN KEY (test_case_id) REFERENCES eval_test_cases (id),
    CONSTRAINT uq_eval_case_results_run_case UNIQUE (eval_run_id, test_case_id)
);

CREATE INDEX IF NOT EXISTS idx_eval_case_results_eval_run_id ON eval_case_results (eval_run_id);
CREATE INDEX IF NOT EXISTS idx_eval_case_results_status ON eval_case_results (status);
