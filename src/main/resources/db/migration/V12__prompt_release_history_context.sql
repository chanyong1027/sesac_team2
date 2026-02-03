ALTER TABLE prompt_release_histories
    ADD COLUMN IF NOT EXISTS context_url VARCHAR(1000);
