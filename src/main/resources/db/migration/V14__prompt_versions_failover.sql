ALTER TABLE prompt_versions
    ADD COLUMN IF NOT EXISTS secondary_provider VARCHAR(50),
    ADD COLUMN IF NOT EXISTS secondary_model VARCHAR(100);
