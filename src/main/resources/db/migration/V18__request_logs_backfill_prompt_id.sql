-- ============================================================
-- V17: request_logs.prompt_id backfill
-- 목적: 기존 로그에 prompt_id가 NULL인 경우, prompts(workspace_id, prompt_key)로 조인하여 채움
-- NOTE: prompt_version_id는 과거 시점의 activeVersion을 복원하기 어려워 backfill 하지 않습니다.
-- ============================================================

UPDATE request_logs rl
SET prompt_id = (
    SELECT p.id
    FROM prompts p
    WHERE p.workspace_id = rl.workspace_id
      AND p.prompt_key = rl.prompt_key
    LIMIT 1
)
WHERE rl.prompt_id IS NULL;

