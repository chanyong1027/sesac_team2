-- ============================================================
-- V18: Budget guardrail (v1)
-- 목적:
--  - BYOK 환경에서 예산 초과를 방지하기 위한 정책/사용량 테이블 추가
--  - ProviderCredential(조직+provider) hard-limit
--  - Workspace soft-limit (degrade)
-- ============================================================

CREATE TABLE IF NOT EXISTS budget_policies (
    id BIGSERIAL PRIMARY KEY,

    -- WORKSPACE | PROVIDER_CREDENTIAL
    scope_type VARCHAR(32) NOT NULL,
    scope_id BIGINT NOT NULL,

    -- hard / soft limit (USD)
    month_limit_usd NUMERIC(18, 8),
    soft_limit_usd NUMERIC(18, 8),

    -- DEGRADE (v1 only)
    soft_action VARCHAR(32) NOT NULL DEFAULT 'DEGRADE',

    -- provider 별 cheap model 매핑 JSON 문자열 (ex: {"openai":"gpt-4o-mini"})
    degrade_provider_model_map TEXT NOT NULL DEFAULT '{}',
    degrade_max_output_tokens INTEGER NOT NULL DEFAULT 512,
    degrade_disable_rag BOOLEAN NOT NULL DEFAULT FALSE,

    enabled BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_budget_policies_scope UNIQUE (scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_budget_policies_scope
    ON budget_policies (scope_type, scope_id);

CREATE TABLE IF NOT EXISTS budget_monthly_usage (
    id BIGSERIAL PRIMARY KEY,

    scope_type VARCHAR(32) NOT NULL,
    scope_id BIGINT NOT NULL,

    -- UTC 기준 YYYYMM (ex: 202602)
    year_month INTEGER NOT NULL,

    cost_usd NUMERIC(18, 8) NOT NULL DEFAULT 0,
    total_tokens BIGINT NOT NULL DEFAULT 0,
    request_count BIGINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_budget_monthly_usage_scope_month UNIQUE (scope_type, scope_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_budget_monthly_usage_scope_month
    ON budget_monthly_usage (scope_type, scope_id, year_month);

