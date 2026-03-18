-- ============================================================
-- V33: Budget reservation / settlement foundation
-- 목적:
--  - hard-limit 동시성 제어를 위한 reserved 비용 추적 컬럼 추가
--  - 요청 단위 reservation 상태 추적 테이블 추가
-- ============================================================

ALTER TABLE budget_monthly_usage
    ADD COLUMN IF NOT EXISTS reserved_cost_usd NUMERIC(18, 8) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS budget_reservations (
    id BIGSERIAL PRIMARY KEY,
    request_log_id UUID,
    trace_id VARCHAR(64) NOT NULL,
    scope_type VARCHAR(32) NOT NULL,
    scope_id BIGINT NOT NULL,
    year_month INTEGER NOT NULL,
    provider VARCHAR(32),
    model VARCHAR(128),
    reserved_cost_usd NUMERIC(18, 8) NOT NULL,
    settled_cost_usd NUMERIC(18, 8),
    reserved_input_tokens INTEGER,
    reserved_output_tokens INTEGER,
    status VARCHAR(32) NOT NULL,
    release_reason VARCHAR(64),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_budget_reservations_trace_scope UNIQUE (trace_id, scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_budget_reservations_scope_month_status
    ON budget_reservations (scope_type, scope_id, year_month, status);

CREATE INDEX IF NOT EXISTS idx_budget_reservations_status_expires
    ON budget_reservations (status, expires_at);
