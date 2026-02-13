-- 플레이그라운드 요청과 게이트웨이 요청을 구분하기 위한 request_source 컬럼 추가
ALTER TABLE request_logs
    ADD COLUMN request_source VARCHAR(16) NOT NULL DEFAULT 'GATEWAY';

-- 통계 쿼리용 복합 인덱스
CREATE INDEX idx_request_logs_ws_source_created
    ON request_logs (workspace_id, request_source, created_at DESC);
