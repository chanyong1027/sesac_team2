-- ============================================================
-- V7: Gateway Request Logs 테이블 (v1)
-- 목적: 게이트웨이 요청 1건당 로그 1건을 DB에 적재하여
--       대시보드/로그 조회/비용 추적의 기반 데이터로 활용
-- ============================================================

-- request_logs: 게이트웨이 요청 로그 (1요청 = 1row)
CREATE TABLE request_logs (
    -- 식별자
    request_id UUID PRIMARY KEY,
    trace_id VARCHAR(64) NOT NULL,

    -- 타임스탬프/성능
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    latency_ms INTEGER,

    -- 테넌트 스코프
    organization_id BIGINT,
    workspace_id BIGINT NOT NULL,
    api_key_id BIGINT,
    api_key_prefix VARCHAR(16),

    -- 요청 메타
    request_path VARCHAR(128) NOT NULL,
    http_method VARCHAR(8) NOT NULL,
    http_status INTEGER,

    -- 결과 상태
    status VARCHAR(16) NOT NULL,
    error_code VARCHAR(64),
    error_message TEXT,
    fail_reason VARCHAR(64),

    -- 프롬프트/모델
    prompt_key VARCHAR(128) NOT NULL,
    prompt_id BIGINT,
    prompt_version_id BIGINT,
    requested_model VARCHAR(128),
    used_model VARCHAR(128),
    provider VARCHAR(32),
    is_failover BOOLEAN NOT NULL DEFAULT FALSE,

    -- 토큰 사용량
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_tokens INTEGER,

    -- 비용
    estimated_cost NUMERIC(18, 8),
    currency CHAR(3) DEFAULT 'USD',
    pricing_version VARCHAR(64),

    -- RAG 관측
    rag_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    rag_top_k INTEGER,
    rag_similarity_threshold DOUBLE PRECISION,
    rag_latency_ms INTEGER,
    rag_chunks_count INTEGER,
    rag_context_chars INTEGER,
    rag_context_truncated BOOLEAN,
    rag_context_hash VARCHAR(64)
);

-- 코멘트
COMMENT ON TABLE request_logs IS '게이트웨이 요청 로그 (v1) - 1요청 1행';
COMMENT ON COLUMN request_logs.request_id IS '요청 고유 ID (UUID)';
COMMENT ON COLUMN request_logs.trace_id IS '분산 추적용 trace ID';
COMMENT ON COLUMN request_logs.status IS '요청 결과: SUCCESS, FAIL, BLOCKED';
COMMENT ON COLUMN request_logs.is_failover IS 'Failover 발생 여부';
COMMENT ON COLUMN request_logs.rag_context_hash IS 'RAG 컨텍스트 SHA-256 해시 (민감정보 비저장)';

-- ============================================================
-- 인덱스: 대시보드/로그 조회 최적화
-- ============================================================

-- 워크스페이스별 로그 리스트 (기본 조회)
CREATE INDEX idx_request_logs_ws_time 
    ON request_logs (workspace_id, created_at DESC);

-- traceId로 단건 조회
CREATE INDEX idx_request_logs_trace 
    ON request_logs (trace_id);

-- 워크스페이스별 상태 필터링
CREATE INDEX idx_request_logs_ws_status_time 
    ON request_logs (workspace_id, status, created_at DESC);

-- 워크스페이스별 failover 필터링
CREATE INDEX idx_request_logs_ws_failover_time 
    ON request_logs (workspace_id, is_failover, created_at DESC);

-- 조직별 사용량 집계
CREATE INDEX idx_request_logs_org_time 
    ON request_logs (organization_id, created_at DESC);
