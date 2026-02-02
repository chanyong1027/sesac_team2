CREATE TABLE IF NOT EXISTS organization_api_keys (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(64) NOT NULL,
    key_prefix VARCHAR(32) NOT NULL,
    status VARCHAR(20) NOT NULL,
    last_used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_organization_api_keys_organization_name UNIQUE (organization_id, name),
    CONSTRAINT uq_organization_api_keys_key_hash UNIQUE (key_hash)
);

CREATE INDEX IF NOT EXISTS idx_organization_api_keys_key_prefix
    ON organization_api_keys (key_prefix);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'organization_api_keys'
    ) THEN
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'organization_api_keys'
              AND column_name = 'org_id'
        ) AND NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'organization_api_keys'
              AND column_name = 'organization_id'
        ) THEN
            EXECUTE 'ALTER TABLE organization_api_keys RENAME COLUMN org_id TO organization_id';
        END IF;
    END IF;
END $$;

ALTER TABLE organization_api_keys
    DROP CONSTRAINT IF EXISTS uq_organization_api_keys_org_name;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_organization_api_keys_organization_name'
    ) THEN
        ALTER TABLE organization_api_keys
            ADD CONSTRAINT uq_organization_api_keys_organization_name
            UNIQUE (organization_id, name);
    END IF;
END $$;

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
                FOREIGN KEY (organization_id) REFERENCES organizations (id);
        END IF;
    END IF;
END $$;
