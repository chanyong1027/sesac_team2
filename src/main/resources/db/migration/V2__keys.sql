CREATE TABLE provider_credential (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    provider VARCHAR(50) NOT NULL,
    key_ciphertext TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,
    last_verified_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_provider_credential_workspace_provider UNIQUE (workspace_id, provider),
    CONSTRAINT fk_provider_credential_workspace
        FOREIGN KEY (workspace_id) REFERENCES workspaces (id)
);

CREATE TABLE gateway_api_key (
    id BIGSERIAL PRIMARY KEY,
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(32) NOT NULL,
    status VARCHAR(20) NOT NULL,
    last_used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_gateway_api_key_key_hash UNIQUE (key_hash)
);

CREATE INDEX idx_gateway_api_key_key_prefix ON gateway_api_key (key_prefix);
