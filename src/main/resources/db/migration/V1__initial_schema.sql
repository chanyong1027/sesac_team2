-- Base schema for core domain tables

CREATE TABLE IF NOT EXISTS console_user (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    password VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organizations (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_by BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_organizations_created_by
        FOREIGN KEY (created_by) REFERENCES console_user(id)
);

CREATE TABLE IF NOT EXISTS organization_members (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role VARCHAR(20) NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_organization_members_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT fk_organization_members_user
        FOREIGN KEY (user_id) REFERENCES console_user(id),
    CONSTRAINT uq_organization_members_organization_user
        UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS workspaces (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    name VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_workspaces_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
    CONSTRAINT uq_workspaces_organization_name
        UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS workspace_members (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role VARCHAR(20) NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_workspace_members_workspace
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
    CONSTRAINT fk_workspace_members_user
        FOREIGN KEY (user_id) REFERENCES console_user(id),
    CONSTRAINT uq_workspace_members_workspace_user
        UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS workspace_invitation_links (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    token VARCHAR(36) NOT NULL UNIQUE,
    role VARCHAR(20) NOT NULL,
    expired_at TIMESTAMPTZ NOT NULL,
    use_count INTEGER NOT NULL DEFAULT 0,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_workspace_invitation_links_workspace
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
    CONSTRAINT fk_workspace_invitation_links_created_by
        FOREIGN KEY (created_by) REFERENCES console_user(id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id BIGSERIAL PRIMARY KEY,
    token VARCHAR(255) NOT NULL UNIQUE,
    user_id BIGINT NOT NULL,
    expiry_date TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_refresh_tokens_user
        FOREIGN KEY (user_id) REFERENCES console_user(id)
);

CREATE TABLE IF NOT EXISTS documents (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_documents_workspace
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
    CONSTRAINT documents_status_check
        CHECK (status IN (
            'UPLOADED',
            'PARSING',
            'CHUNKING',
            'EMBEDDING',
            'INDEXING',
            'DONE',
            'FAILED',
            'ACTIVE',
            'DELETING',
            'DELETED'
        ))
);
