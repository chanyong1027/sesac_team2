-- Prompt Management Tables

-- 1. prompts 테이블
CREATE TABLE IF NOT EXISTS prompts (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    prompt_key VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_prompts_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
    CONSTRAINT uq_prompts_workspace_prompt_key UNIQUE (workspace_id, prompt_key)
);

CREATE INDEX IF NOT EXISTS idx_prompts_workspace_id ON prompts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_prompts_status ON prompts(status);

-- 2. prompt_versions 테이블
CREATE TABLE IF NOT EXISTS prompt_versions (
    id BIGSERIAL PRIMARY KEY,
    prompt_id BIGINT NOT NULL,
    version_no INTEGER NOT NULL,
    title VARCHAR(100),
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    system_prompt TEXT,
    user_template TEXT,
    model_config JSONB,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_prompt_versions_prompt FOREIGN KEY (prompt_id) REFERENCES prompts(id),
    CONSTRAINT fk_prompt_versions_created_by FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT uq_prompt_versions_prompt_version UNIQUE (prompt_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt_id ON prompt_versions(prompt_id);

-- 3. prompt_releases 테이블 (1:1 관계)
CREATE TABLE IF NOT EXISTS prompt_releases (
    prompt_id BIGINT PRIMARY KEY,
    active_version_id BIGINT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_prompt_releases_prompt FOREIGN KEY (prompt_id) REFERENCES prompts(id),
    CONSTRAINT fk_prompt_releases_version FOREIGN KEY (active_version_id) REFERENCES prompt_versions(id)
);

-- 4. prompt_release_histories 테이블
CREATE TABLE IF NOT EXISTS prompt_release_histories (
    id BIGSERIAL PRIMARY KEY,
    prompt_id BIGINT NOT NULL,
    from_version_id BIGINT,
    to_version_id BIGINT NOT NULL,
    change_type VARCHAR(20) NOT NULL,
    reason VARCHAR(500),
    changed_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_prompt_release_histories_prompt FOREIGN KEY (prompt_id) REFERENCES prompts(id),
    CONSTRAINT fk_prompt_release_histories_from_version FOREIGN KEY (from_version_id) REFERENCES prompt_versions(id),
    CONSTRAINT fk_prompt_release_histories_to_version FOREIGN KEY (to_version_id) REFERENCES prompt_versions(id),
    CONSTRAINT fk_prompt_release_histories_changed_by FOREIGN KEY (changed_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_prompt_release_histories_prompt_id ON prompt_release_histories(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_release_histories_created_at ON prompt_release_histories(created_at DESC);
