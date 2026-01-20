DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'provider_credentials'
          AND column_name = 'org_id'
    ) THEN
        ALTER TABLE provider_credentials
            RENAME COLUMN org_id TO organization_id;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_provider_credentials_org_provider'
    ) THEN
        ALTER TABLE provider_credentials
            RENAME CONSTRAINT uq_provider_credentials_org_provider
            TO uq_provider_credentials_organization_provider;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_provider_credentials_organization'
    ) THEN
        ALTER TABLE provider_credentials
            RENAME CONSTRAINT fk_provider_credentials_organization
            TO fk_provider_credentials_organization_id;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'organization_api_keys'
          AND column_name = 'org_id'
    ) THEN
        ALTER TABLE organization_api_keys
            RENAME COLUMN org_id TO organization_id;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_organization_api_keys_org_name'
    ) THEN
        ALTER TABLE organization_api_keys
            RENAME CONSTRAINT uq_organization_api_keys_org_name
            TO uq_organization_api_keys_organization_name;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_organization_api_keys_organization'
    ) THEN
        ALTER TABLE organization_api_keys
            RENAME CONSTRAINT fk_organization_api_keys_organization
            TO fk_organization_api_keys_organization_id;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'workspaces'
          AND column_name = 'org_id'
    ) THEN
        ALTER TABLE workspaces
            RENAME COLUMN org_id TO organization_id;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'organization_members'
          AND column_name = 'org_id'
    ) THEN
        ALTER TABLE organization_members
            RENAME COLUMN org_id TO organization_id;
    END IF;
END $$;
