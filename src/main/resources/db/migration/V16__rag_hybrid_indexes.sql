CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS hstore;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.doc_chunks_v2 (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    content text,
    metadata json,
    embedding vector(1536)
);

CREATE INDEX IF NOT EXISTS doc_chunks_v2_embedding_hnsw_idx
    ON public.doc_chunks_v2 USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS doc_chunks_v2_fts_idx
    ON public.doc_chunks_v2 USING GIN (to_tsvector('simple', content));

CREATE INDEX IF NOT EXISTS doc_chunks_v2_trgm_idx
    ON public.doc_chunks_v2 USING GIN (content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS doc_chunks_v2_workspace_idx
    ON public.doc_chunks_v2 ((metadata->>'workspace_id'));
