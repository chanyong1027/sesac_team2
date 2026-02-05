DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'provider_credential'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'provider_credentials'
    ) THEN
        EXECUTE 'ALTER TABLE provider_credential RENAME TO provider_credentials';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'provider_credentials'
          AND column_name = 'workspace_id'
    ) THEN
        EXECUTE 'ALTER TABLE provider_credentials RENAME COLUMN workspace_id TO org_id';
    END IF;
END $$;

ALTER TABLE IF EXISTS provider_credentials
    DROP CONSTRAINT IF EXISTS uq_provider_credential_workspace_provider;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'provider_credentials'
          AND column_name = 'org_id'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'uq_provider_credentials_org_provider'
        ) THEN
            ALTER TABLE provider_credentials
                ADD CONSTRAINT uq_provider_credentials_org_provider UNIQUE (org_id, provider);
        END IF;
    END IF;
END $$;

ALTER TABLE IF EXISTS provider_credentials
    DROP CONSTRAINT IF EXISTS fk_provider_credential_workspace;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'organizations'
    ) AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'provider_credentials'
          AND column_name = 'org_id'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'fk_provider_credentials_organization'
        ) THEN
            ALTER TABLE provider_credentials
                ADD CONSTRAINT fk_provider_credentials_organization
                FOREIGN KEY (org_id) REFERENCES organizations (id);
        END IF;
    END IF;
END $$;
