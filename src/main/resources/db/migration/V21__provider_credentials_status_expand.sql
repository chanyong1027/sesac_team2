ALTER TABLE provider_credentials
    DROP CONSTRAINT IF EXISTS provider_credentials_status_check;

ALTER TABLE provider_credentials
    ADD CONSTRAINT provider_credentials_status_check
    CHECK (status IN ('ACTIVE', 'VERIFYING', 'INVALID', 'REVOKED'));
