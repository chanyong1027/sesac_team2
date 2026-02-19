-- ============================================================
-- V22: Request Log 페이로드 저장 + 검색 문서 테이블
-- 목적: LLM 관측성(Observability) 강화
--   1) 사용자 질문/AI 답변 원문 저장 → 품질 분석, 디버깅
--   2) RAG 검색 문서 상세 저장 → 검색 품질 검증
-- 주의: request_source 컬럼은 V20에서 추가되므로 여기서 중복 추가하지 않습니다.
-- ============================================================

-- 1) request_logs: payload 컬럼 추가
ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS request_payload TEXT;
ALTER TABLE request_logs ADD COLUMN IF NOT EXISTS response_payload TEXT;

COMMENT ON COLUMN request_logs.request_payload IS '사용자 요청 전체 (JSON)';
COMMENT ON COLUMN request_logs.response_payload IS 'AI 응답 전체';

-- 2) retrieved_documents: RAG 검색 문서 상세 테이블
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
COMMENT ON COLUMN retrieved_documents.ranking IS '검색 순위 (1부터 시작, 0은 순위 없음)';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_retrieved_documents_request_id
    ON retrieved_documents (request_id);
