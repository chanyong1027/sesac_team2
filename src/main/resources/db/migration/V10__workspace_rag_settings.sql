CREATE TABLE IF NOT EXISTS workspace_rag_settings (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL UNIQUE,
    top_k INTEGER NOT NULL,
    similarity_threshold DOUBLE PRECISION NOT NULL,
    max_chunks INTEGER NOT NULL,
    max_context_chars INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_workspace_rag_settings_workspace
        FOREIGN KEY (workspace_id)
        REFERENCES workspaces (id)
        ON DELETE CASCADE
);
