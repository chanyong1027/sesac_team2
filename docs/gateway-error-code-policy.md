# Gateway Error Code Policy (MVP)

이 문서는 Gateway 요청 실패를 `error_code + fail_reason`으로 표준화하는 운영 기준입니다.

## 1) 목적

1. 로그 조회에서 실패 원인을 빠르게 분류/집계
2. 운영자가 `error_code`만으로 대응 우선순위 판단
3. 상세 원인은 `fail_reason`으로 보강

## 2) 표준 코드 (10개 고정)

1. `GW-REQ-INVALID_REQUEST`
2. `GW-REQ-UNAUTHORIZED`
3. `GW-REQ-FORBIDDEN`
4. `GW-REQ-QUOTA_EXCEEDED`
5. `GW-UP-RATE_LIMIT`
6. `GW-UP-TIMEOUT`
7. `GW-UP-UNAVAILABLE`
8. `GW-UP-MODEL_NOT_FOUND`
9. `GW-GW-POLICY_BLOCKED`
10. `GW-GW-ALL_PROVIDERS_FAILED`

## 3) 컬럼 매핑 규칙

1. `request_logs.error_code`
2. 위 10개 코드 중 하나만 저장
3. `request_logs.fail_reason`
4. 상세 원인 저장
5. 예: `HTTP_429`, `HTTP_503`, `SOCKET_TIMEOUT`, `RESOURCE_EXHAUSTED`, `MODEL_404`, `PROVIDER_BUDGET_EXCEEDED`
6. `request_logs.error_message`
7. 사용자 안내용 짧은 문구 저장

## 4) Failover/Retry 정책

1. 즉시 failover
2. 조건: `GW-UP-RATE_LIMIT`, `GW-UP-MODEL_NOT_FOUND`
3. 1회 retry 후 failover
4. 조건: `GW-UP-TIMEOUT`, `GW-UP-UNAVAILABLE`
5. fail-fast
6. 조건: `GW-REQ-*`, `GW-GW-POLICY_BLOCKED`
7. 모든 경로 실패
8. 최종 코드: `GW-GW-ALL_PROVIDERS_FAILED`

## 4-1) 전역 시간예산 (Global Deadline)

1. 요청 1건은 `gateway.reliability.request-timeout-ms`(기본 20초) 내에서만 처리합니다.
2. 각 단계(호출/재시도/failover) 시작 전 남은 시간을 확인합니다.
3. 남은 시간이 0이면 즉시 `GW-UP-TIMEOUT` + `REQUEST_DEADLINE_EXCEEDED`로 종료합니다.
4. timeout/5xx 정책이라도 남은 시간이 부족하면 retry를 생략하고 failover를 우선 시도합니다.
5. failover 최소 예산(`gateway.reliability.min-failover-budget-ms`)보다 남은 시간이 작으면 failover 없이 timeout 종료합니다.

## 5) 운영 해석 가이드

1. `GW-REQ-*` 비율 증가
2. 클라이언트 요청 검증/인증/권한 설정 점검
3. `GW-UP-RATE_LIMIT` 증가
4. 업스트림 트래픽 급증/쿼터 확인, secondary fallback 설정 확인
5. `GW-UP-TIMEOUT`/`GW-UP-UNAVAILABLE` 증가
6. 네트워크 상태, 업스트림 상태, retry/failover 동작 확인
7. `GW-GW-ALL_PROVIDERS_FAILED` 발생
8. secondary까지 포함한 전체 경로 실패. 장애 대응 우선순위 상향

## 6) 비범위

1. OpenAI 호환 요청 스키마 도입
2. `request_logs` 신규 컬럼 추가 (`retryable/action/attempts` 등)
3. Gateway 성공 응답 스키마 변경
