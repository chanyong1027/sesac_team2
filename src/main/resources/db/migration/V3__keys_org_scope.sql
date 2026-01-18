ALTER TABLE IF EXISTS provider_credential RENAME TO provider_credentials;
ALTER TABLE IF EXISTS provider_credentials RENAME COLUMN workspace_id TO org_id;

ALTER TABLE IF EXISTS provider_credentials
    DROP CONSTRAINT IF EXISTS uq_provider_credential_workspace_provider;
ALTER TABLE IF EXISTS provider_credentials
    ADD CONSTRAINT uq_provider_credentials_org_provider UNIQUE (org_id, provider);

ALTER TABLE IF EXISTS provider_credentials
    DROP CONSTRAINT IF EXISTS fk_provider_credential_workspace;

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
            WHERE conname = 'fk_provider_credentials_organization'
        ) THEN
            ALTER TABLE provider_credentials
                ADD CONSTRAINT fk_provider_credentials_organization
                FOREIGN KEY (org_id) REFERENCES organizations (id);
        END IF;
    END IF;
END $$;
