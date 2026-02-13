-- ============================================================
-- V20: Request Log 페이로드 저장 + 검색 문서 테이블
-- 목적: LLM 관측성(Observability) 강화
--   1) 사용자 질문/AI 답변 원문 저장 → 품질 분석, 디버깅
--   2) 요청 출처 구분 (GATEWAY/PLAYGROUND)
--   3) RAG 검색 문서 상세 저장 → 검색 품질 검증
-- ============================================================

-- 1) request_logs: payload 컬럼 추가
ALTER TABLE request_logs ADD COLUMN request_payload TEXT;
ALTER TABLE request_logs ADD COLUMN response_payload TEXT;

-- 2) request_logs: 요청 출처 컬럼 추가
ALTER TABLE request_logs ADD COLUMN request_source VARCHAR(16) NOT NULL DEFAULT 'GATEWAY';

COMMENT ON COLUMN request_logs.request_payload IS '사용자 요청 전체 (JSON)';
COMMENT ON COLUMN request_logs.response_payload IS 'AI 응답 전체';
COMMENT ON COLUMN request_logs.request_source IS '요청 출처: GATEWAY, PLAYGROUND';

-- 3) retrieved_documents: RAG 검색 문서 상세 테이블
CREATE TABLE IF NOT EXISTS retrieved_documents (
    id BIGSERIAL PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES request_logs(request_id) ON DELETE CASCADE,
    document_name VARCHAR(512),
    score DOUBLE PRECISION,
    content TEXT,
    duration_ms INTEGER,
    ranking INTEGER NOT NULL DEFAULT 0
);

COMMENT ON TABLE retrieved_documents IS 'RAG 검색 결과 문서 (1요청 N문서)';
COMMENT ON COLUMN retrieved_documents.score IS '벡터 유사도 점수';
COMMENT ON COLUMN retrieved_documents.ranking IS '검색 순위 (1부터 시작)';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_retrieved_documents_request_id
    ON retrieved_documents (request_id);
