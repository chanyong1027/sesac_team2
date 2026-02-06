ALTER TABLE workspace_rag_settings
    ADD COLUMN IF NOT EXISTS hybrid_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE workspace_rag_settings
    ADD COLUMN IF NOT EXISTS rerank_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE workspace_rag_settings
    ADD COLUMN IF NOT EXISTS rerank_top_n INTEGER NOT NULL DEFAULT 10;

-- Chunking settings are applied at ingest time.
-- If you change these, re-ingest documents to apply them to existing content.
ALTER TABLE workspace_rag_settings
    ADD COLUMN IF NOT EXISTS chunk_size INTEGER NOT NULL DEFAULT 500;

ALTER TABLE workspace_rag_settings
    ADD COLUMN IF NOT EXISTS chunk_overlap_tokens INTEGER NOT NULL DEFAULT 50;

