ALTER TABLE request_logs
    ADD COLUMN IF NOT EXISTS attempts_explicitly_empty BOOLEAN;

COMMENT ON COLUMN request_logs.attempts_explicitly_empty IS
    'Gateway 시도 수집이 수행되었지만 실제 provider attempt가 0건이면 TRUE, legacy/비게이트웨이/미확정 데이터는 NULL';

DROP INDEX IF EXISTS idx_request_log_attempts_request_attempt_no;
