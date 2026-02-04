ALTER TABLE prompt_versions
    ADD COLUMN IF NOT EXISTS context_url VARCHAR(1000);
