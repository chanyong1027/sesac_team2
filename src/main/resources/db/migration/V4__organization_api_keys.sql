CREATE TABLE IF NOT EXISTS organization_api_keys (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(64) NOT NULL,
    key_prefix VARCHAR(32) NOT NULL,
    status VARCHAR(20) NOT NULL,
    last_used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_organization_api_keys_org_name UNIQUE (org_id, name),
    CONSTRAINT uq_organization_api_keys_key_hash UNIQUE (key_hash)
);

CREATE INDEX IF NOT EXISTS idx_organization_api_keys_key_prefix
    ON organization_api_keys (key_prefix);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'organizations'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'fk_organization_api_keys_organization'
        ) THEN
            ALTER TABLE organization_api_keys
                ADD CONSTRAINT fk_organization_api_keys_organization
                FOREIGN KEY (org_id) REFERENCES organizations (id);
        END IF;
    END IF;
END $$;
