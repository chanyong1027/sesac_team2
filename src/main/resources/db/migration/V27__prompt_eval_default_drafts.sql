CREATE TABLE IF NOT EXISTS prompt_eval_default_drafts (
    id BIGSERIAL PRIMARY KEY,
    prompt_id BIGINT NOT NULL UNIQUE,
    dataset_id BIGINT,
    rubric_template_code VARCHAR(50),
    rubric_overrides_json JSONB,
    criteria_anchors_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    default_mode VARCHAR(30),
    auto_eval_enabled BOOLEAN,
    completed_sections_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_prompt_eval_default_drafts_prompt
        FOREIGN KEY (prompt_id) REFERENCES prompts (id) ON DELETE CASCADE,
    CONSTRAINT fk_prompt_eval_default_drafts_dataset
        FOREIGN KEY (dataset_id) REFERENCES eval_datasets (id) ON DELETE SET NULL,
    CONSTRAINT fk_prompt_eval_default_drafts_updated_by
        FOREIGN KEY (updated_by) REFERENCES console_user (id)
);

CREATE INDEX IF NOT EXISTS idx_prompt_eval_default_drafts_updated_at
    ON prompt_eval_default_drafts (updated_at DESC);
