-- ============================================================
-- V30: Request Log Attempt Timeline
-- 목적: 1요청 내부의 provider 시도(primary/retry/failover) 이력을 저장
-- ============================================================

CREATE TABLE IF NOT EXISTS request_log_attempts (
    id BIGSERIAL PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES request_logs(request_id) ON DELETE CASCADE,
    attempt_no INTEGER NOT NULL,
    route VARCHAR(16) NOT NULL,
    retry BOOLEAN NOT NULL DEFAULT FALSE,
    result VARCHAR(16) NOT NULL,
    provider VARCHAR(32),
    requested_model VARCHAR(128),
    used_model VARCHAR(128),
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ NOT NULL,
    latency_ms INTEGER NOT NULL,
    http_status INTEGER,
    error_code VARCHAR(64),
    fail_reason VARCHAR(64),
    error_message TEXT,
    backoff_after_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE request_log_attempts
    ADD CONSTRAINT uq_request_log_attempts_request_attempt_no
    UNIQUE (request_id, attempt_no);

CREATE INDEX IF NOT EXISTS idx_request_log_attempts_request_attempt_no
    ON request_log_attempts (request_id, attempt_no);

COMMENT ON TABLE request_log_attempts IS '게이트웨이 요청 1건 내 시도(primary/retry/failover) 이력';
COMMENT ON COLUMN request_log_attempts.route IS '시도 경로: PRIMARY | FAILOVER';
COMMENT ON COLUMN request_log_attempts.result IS '시도 결과: SUCCESS | FAIL | TIMEOUT';
COMMENT ON COLUMN request_log_attempts.backoff_after_ms IS '해당 시도 실패 후 다음 시도 전 대기 시간(ms)';
