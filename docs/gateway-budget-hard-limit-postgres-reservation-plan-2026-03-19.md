# Gateway 예산 Hard-limit 동시성 보장 설계안

작성일: 2026-03-19

이 문서는 Gateway 예산 Hard-limit를 `사후 누적` 방식에서 `Postgres 원자적 예약 + 사후 정산` 방식으로 전환하기 위한 전체 설계 플랜과 ADR을 정리합니다.

## 1) 문서 목적

1. 현재 예산 가드레일 구현의 동시성 한계를 명확히 설명한다.
2. Redis 없이 PostgreSQL만으로 hard-limit를 일관되게 보장하는 설계 기준을 고정한다.
3. DB 스키마, 서비스 책임, 게이트웨이 호출 흐름, 복구 전략, 테스트 범위를 한 문서에서 공유한다.
4. 구현 순서와 롤아웃 단계가 분명한 실행 계획을 제공한다.

## 2) 현재 상태 요약

현재 Gateway 예산 흐름은 아래 순서입니다.

1. 호출 전 `BudgetGuardrailService`가 현재 월 사용량을 조회한다.
2. Workspace는 soft-limit 초과 시 `DEGRADE`를 결정한다.
3. Provider credential은 hard-limit 초과 시 `BLOCK`를 결정한다.
4. LLM 호출이 성공하면 `BudgetUsageService.recordUsage()`가 실제 비용을 월 사용량 테이블에 누적한다.

현재 구조의 장점은 단순하다는 점입니다. 하지만 hard-limit 동시성 보장 관점에서는 아래 한계가 있습니다.

1. 여러 요청이 동시에 같은 월 사용량을 읽고 모두 "아직 limit 미만"으로 판단할 수 있다.
2. 호출이 끝난 뒤에만 비용을 반영하므로 in-flight 요청은 예산 판단에서 보이지 않는다.
3. 기존 `budget_monthly_usage` row 갱신은 원자적 증가 SQL이 아니라 JPA entity 누적이어서 lost update 가능성이 있다.
4. strict hard-limit를 설명해야 하는 상황에서 현재 구조는 방어가 어렵다.

한 줄 요약:

`조회 -> 호출 -> 사후 누적`은 soft guardrail에는 쓸 수 있지만, 동시 요청 환경의 hard-limit 보장 방식으로는 부족하다.

## 3) 목표와 비목표

### 목표

1. 같은 scope에 여러 요청이 동시에 들어와도 hard-limit 초과 판단이 일관되게 동작한다.
2. LLM 호출 시간 동안 DB 트랜잭션, row lock, connection을 붙잡지 않는다.
3. 요청 성공 시 실제 비용만 확정 반영하고, 남은 예약액은 반환한다.
4. 요청 실패, timeout, 프로세스 중단 시에도 예약 누수를 복구할 수 있다.
5. 운영자가 reservation 상태를 로그와 메트릭으로 추적할 수 있다.

### 비목표

1. 예산 정책 UI/UX 개편
2. Redis 도입
3. 모델 단가 DB 이관
4. 모든 provider 과금 규칙의 완전한 실시간 정밀 재현
5. Playground 비용 경로까지 이번에 동시에 전환

## 4) 핵심 결정 요약

이번 설계의 핵심은 hard-limit를 아래 두 단계로 분리하는 것입니다.

1. 예약
- 요청 시작 시 최대 가능 비용 상한을 계산한다.
- Postgres에서 조건부 update로 해당 금액을 먼저 예약한다.
- 예약 성공한 요청만 LLM 호출을 진행한다.

2. 정산
- 호출 완료 후 실제 비용을 계산한다.
- 예약액 중 실제 사용액만 `spent`로 확정한다.
- 남은 금액은 반환한다.

이 방식은 비관적 락처럼 LLM 호출 시간 동안 DB를 붙잡지 않으면서도, in-flight 요청까지 포함한 hard-limit 판단이 가능하다는 점에서 현재 스택에 가장 적합하다.

## 5) 용어 정의

1. `spent`
- 이미 확정된 실제 사용 금액
- 기존 `budget_monthly_usage.cost_usd`가 담당

2. `reserved`
- 아직 호출이 끝나지 않았지만 hard-limit 판단을 위해 선점한 금액
- 새 컬럼 `reserved_cost_usd`가 담당

3. `reservation`
- 요청 단위의 예약 레코드
- reservation amount, 상태, 만료 시각, 정산 결과를 기록

4. `effective max tokens`
- prompt version의 `modelConfig.maxTokens`와 budget degrade override를 반영한 최종 출력 토큰 상한

5. `projected spend`
- `spent + reserved`
- soft-limit 평가와 hard-limit 조건식의 기준

## 6) 목표 아키텍처

요청 1건의 이상적인 흐름은 아래와 같습니다.

1. 인증 및 프롬프트 해석
2. Workspace soft-limit 평가
3. effective model / effective max tokens 결정
4. 최대 가능 비용 상한 계산
5. Provider credential hard-limit 예약 시도
6. 필요 시 workspace hard-limit 예약 시도
7. 예약 성공 시 provider 호출
8. 성공하면 settle
9. 실패하면 release
10. timeout 또는 프로세스 중단으로 누락된 reservation은 sweeper가 expire

핵심 원칙은 다음과 같습니다.

1. DB는 `예약 승인/거절`만 짧게 결정한다.
2. LLM 호출은 예약 후 DB와 분리된 상태에서 수행한다.
3. 정산과 반환은 idempotent해야 한다.
4. failover는 secondary 기준으로 다시 예약하는 독립 경로로 본다.

## 7) 데이터 모델 설계

### 7-1) `budget_monthly_usage` 확장

기존 테이블은 유지하되 아래 컬럼을 추가합니다.

1. `reserved_cost_usd NUMERIC(18, 8) NOT NULL DEFAULT 0`

기존 컬럼 의미는 아래처럼 고정합니다.

1. `cost_usd`
- 확정 사용 금액

2. `total_tokens`
- 확정 사용 토큰

3. `request_count`
- 확정 완료된 요청 수

4. `reserved_cost_usd`
- 아직 정산되지 않은 in-flight 예약 총액

### 7-2) `budget_reservations` 신규 테이블

요청 단위 reservation 추적용 테이블을 추가합니다.

예상 컬럼:

1. `id BIGSERIAL PRIMARY KEY`
2. `request_log_id UUID NULL`
3. `trace_id VARCHAR(64) NOT NULL`
4. `scope_type VARCHAR(32) NOT NULL`
5. `scope_id BIGINT NOT NULL`
6. `year_month INTEGER NOT NULL`
7. `provider VARCHAR(32) NULL`
8. `model VARCHAR(128) NULL`
9. `reserved_cost_usd NUMERIC(18, 8) NOT NULL`
10. `settled_cost_usd NUMERIC(18, 8) NULL`
11. `reserved_input_tokens INTEGER NULL`
12. `reserved_output_tokens INTEGER NULL`
13. `status VARCHAR(32) NOT NULL`
14. `release_reason VARCHAR(64) NULL`
15. `expires_at TIMESTAMPTZ NOT NULL`
16. `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
17. `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

권장 unique 제약:

1. `uq_budget_reservations_trace_scope (trace_id, scope_type, scope_id)`

이 unique key는 같은 요청이 같은 scope에 대해 예약을 중복 생성하지 않도록 방지합니다.

### 7-3) reservation 상태

1. `RESERVED`
- 예약 성공, 아직 호출/정산 미완료

2. `SETTLED`
- 실제 사용액 확정 반영 완료

3. `RELEASED`
- 실패 또는 정책상 취소되어 예약 전액 반환 완료

4. `EXPIRED`
- TTL 경과 후 백그라운드 복구 작업으로 반환 완료

## 8) 예약 금액 계산 정책

예약은 평균 예상치가 아니라 최대 가능 비용 상한을 기준으로 해야 합니다.

### 8-1) 입력 토큰 상한

입력 토큰 상한은 아래를 합쳐 계산합니다.

1. system prompt 렌더링 결과
2. user prompt 렌더링 결과
3. RAG context가 활성화되면 최종 주입된 context
4. provider별 message framing 오버헤드 safety margin

토큰 계산은 이미 의존성에 포함된 `jtokkit`을 사용합니다.

정책:

1. 기본 tokenizer는 `CL100K_BASE`를 사용한다.
2. provider별 tokenizer 차이는 우선 안전계수로 흡수한다.
3. 1차 rollout에서는 `budget.reservation.input-token-safety-multiplier` 기본값 `1.10`을 사용한다.

### 8-2) 출력 토큰 상한

출력 토큰은 실제 응답 전에는 알 수 없으므로 아래 순서로 상한을 잡습니다.

1. budget degrade override의 `maxOutputTokens`
2. prompt version `modelConfig.maxTokens`
3. 시스템 기본값

기본값 제안:

1. `2048`

현재 구현은 `budget.reservation.default-max-output-tokens` 설정으로 이 값을 외부화한다.

### 8-3) 비용 계산식

비용 계산은 기존 `ModelPricing`을 재사용합니다.

`reserveAmount = cost(model, estimatedInputTokensUpperBound, effectiveMaxTokens)`

정책:

1. 모델 단가를 알 수 있으면 해당 단가로 계산한다.
2. 모델 단가를 모르면 hard-limit는 fail-closed 한다.
3. 단가 미등록 모델은 `GW-GW-POLICY_BLOCKED` 또는 `BUDGET_PRICING_UNAVAILABLE` 성격의 내부 사유로 차단한다.

## 9) 원자적 예약 알고리즘

### 9-1) usage row 보장

월별 usage row가 없을 수 있으므로 먼저 아래와 같이 row를 보장합니다.

```sql
INSERT INTO budget_monthly_usage (
    scope_type, scope_id, year_month, cost_usd, total_tokens, request_count, reserved_cost_usd, created_at, updated_at
)
SELECT
    :scopeType, :scopeId, :yearMonth, 0, 0, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1
    FROM budget_monthly_usage
    WHERE scope_type = :scopeType
      AND scope_id = :scopeId
      AND year_month = :yearMonth
);
```

현재 repository 구현은 H2 기반 테스트 환경까지 같이 통과시키기 위해 위와 같은 조건부 insert를 사용하고, 동시 생성 경합은 unique 제약과 `DataIntegrityViolationException` 흡수로 마무리합니다. 실제 hard-limit 승인/거절의 일관성은 아래 `reserve update`가 담당합니다.

### 9-2) 예약 승인

예약 승인 핵심 쿼리는 아래와 같습니다.

```sql
UPDATE budget_monthly_usage u
SET reserved_cost_usd = u.reserved_cost_usd + :reserveAmount
WHERE u.scope_type = :scopeType
  AND u.scope_id = :scopeId
  AND u.year_month = :yearMonth
  AND u.cost_usd + u.reserved_cost_usd + :reserveAmount <= :monthLimitUsd;
```

결과 해석:

1. update count = 1
- 예약 성공

2. update count = 0
- 예산 초과로 예약 실패

이 쿼리의 장점은 조건 검사와 증가가 DB 안에서 한 번에 일어나므로, 동시 요청에서도 race condition 없이 승인/거절이 결정된다는 점입니다.

### 9-3) reservation 레코드 생성

usage row 예약 성공 후에 `budget_reservations`에 `RESERVED` 상태를 INSERT 합니다.

실패 시 처리:

1. reservation INSERT 실패 시 같은 트랜잭션 안에서 `reserved_cost_usd`를 되돌린다.
2. trace 중복이면 기존 reservation 상태를 조회해 idempotent 처리한다.

## 10) 정산 및 반환 알고리즘

### 10-1) 성공 시 settle

성공 시에는 reservation을 읽고 아래 순서로 처리합니다.

1. `actualCostUsd` 계산
2. `reserved_cost_usd -= reservedAmount`
3. `cost_usd += actualCostUsd`
4. `total_tokens += actualTokens`
5. `request_count += 1`
6. reservation status를 `SETTLED`로 변경
7. `settled_cost_usd = actualCostUsd` 저장

핵심 원칙:

1. 정산은 reservation row 기준으로 한 번만 일어나야 한다.
2. 이미 `SETTLED`, `RELEASED`, `EXPIRED` 상태면 중복 정산하지 않는다.

### 10-2) 실패 시 release

실패 시에는 아래 순서로 처리합니다.

1. `reserved_cost_usd -= reservedAmount`
2. reservation status를 `RELEASED`로 변경
3. `release_reason` 저장

실패 사유 예시:

1. `PROVIDER_TIMEOUT`
2. `PROVIDER_ERROR`
3. `FAILOVER_RETRY`
4. `REQUEST_CANCELLED`
5. `PRIMARY_ROUTE_FAILED`

### 10-3) expire sweeper

reservation이 `RESERVED` 상태인데 `expires_at < now()`이면 stale reservation으로 판단합니다.

백그라운드 작업은 아래를 수행합니다.

1. 만료 대상 reservation batch 조회
2. usage row의 `reserved_cost_usd` 반환
3. reservation status를 `EXPIRED`로 변경
4. metric 및 warn log 기록

TTL 기준:

1. `gateway.reliability.request-timeout-ms + buffer`
2. 기본 buffer는 10초 제안

## 11) Gateway 호출 흐름 통합

### 11-1) primary 성공 경로

1. workspace soft-limit 평가
2. effective model / max tokens 결정
3. provider credential 예산 예약
4. workspace hard-limit 예약
5. provider call
6. 실제 비용 계산
7. provider reservation settle
8. workspace reservation settle
9. success log 기록

### 11-2) primary blocked 경로

1. primary provider credential reservation 실패
2. secondary 경로가 없으면 즉시 budget exceeded 반환
3. secondary가 있으면 secondary 기준으로 새 예약 시도
4. secondary도 예약 실패하면 blocked 반환

### 11-3) primary 실패 후 failover 경로

1. primary 예약 성공
2. primary 호출 실패
3. primary reservation release
4. secondary provider 기준으로 새 상한 계산
5. secondary reservation 시도
6. 성공 시 secondary 호출
7. 성공하면 secondary settle, 실패하면 secondary release

이 경로를 쓰는 이유:

1. primary와 secondary는 모델 단가, output 상한, provider budget scope가 다를 수 있다.
2. failover는 "같은 예약을 이어서 사용"하는 문제가 아니라 "새 경로에 대한 새 예약"으로 보는 편이 단순하다.

## 12) Soft-limit와의 상호작용

soft-limit는 hard-limit처럼 차단보다 `DEGRADE`가 목적입니다.

따라서 평가 기준을 아래로 바꿉니다.

1. 기존: `cost_usd >= soft_limit`
2. 변경: `cost_usd + reserved_cost_usd >= soft_limit`

이렇게 하면 이미 진행 중인 요청까지 반영해 더 일찍 degrade가 걸릴 수 있습니다.

정책상 soft-limit는 약간 보수적으로 반응해도 문제가 적기 때문에, projected spend 기준이 더 운영 친화적입니다.

## 13) 트랜잭션 경계

이번 설계에서 가장 중요한 원칙은 "짧은 트랜잭션"입니다.

### 트랜잭션 1: reserve

포함:

1. usage row 보장
2. 조건부 reserve update
3. reservation row insert

비포함:

1. provider call

### 트랜잭션 2: settle

포함:

1. reservation 상태 검증
2. reserved 감소
3. spent 증가
4. tokens/request_count 증가
5. reservation 상태 변경

### 트랜잭션 3: release

포함:

1. reservation 상태 검증
2. reserved 감소
3. reservation 상태 변경

즉 LLM 호출 구간은 어떤 트랜잭션 안에도 포함되지 않습니다.

## 14) 서비스 책임 분리안

### `BudgetReservationEstimator`

책임:

1. input token 상한 계산
2. output token 상한 계산
3. 모델 단가 기반 reserve amount 계산

### `BudgetReservationService`

책임:

1. reserve
2. settle
3. release
4. expire stale reservations

### `BudgetGuardrailService`

책임:

1. workspace soft-limit degrade 의사결정
2. projected spend 기반 정책 평가

### `GatewayChatService`

책임:

1. reservation 시점 orchestration
2. primary/secondary 경로 전환
3. success/failure에 따른 settle/release 호출

## 15) 단계별 구현 플랜

### Epic 21. Gateway 예산 Hard-limit 동시성 보장

### [x] E21-1 현행 예산 경로 분석 및 ADR 고정

- 목표: 현재 hard-limit 동작과 동시성 gap을 문서로 확정한다.
- 범위: Gateway, budget, pricing, request log 경로 분석.
- 완료 조건: 이 문서와 ADR이 팀 합의본으로 사용된다.
- 검증: 설계 리뷰.

### [x] E21-2 DB 스키마 확장

- 목표: reservation을 저장할 최소 스키마를 도입한다.
- 범위: `budget_monthly_usage` 컬럼 추가, `budget_reservations` 신규 테이블, 인덱스/unique 제약.
- 완료 조건: migration이 로컬/테스트 DB에 정상 적용된다.
- 검증: Flyway migration 실행.

### [x] E21-3 Repository와 원자적 SQL 도입

- 목표: reserve/settle/release를 native query로 구현한다.
- 범위: usage upsert, reserve update, settle update, release update, stale reservation 조회.
- 완료 조건: lost update 없이 row count 기반 예약 결과를 얻는다.
- 검증: `BudgetMonthlyUsageRepositoryTest`, `BudgetReservationRepositoryTest`, `BudgetReservationServiceTest`, `BudgetGuardrailServiceTest`.

### [x] E21-4 최대 비용 상한 계산기 도입

- 목표: 예약액을 deterministic하게 계산한다.
- 범위: jtokkit 기반 token estimate, effective max tokens, unknown model 정책.
- 완료 조건: reserve amount가 provider/model별로 재현 가능하다.
- 검증: `BudgetReservationEstimatorTest`, `BudgetReservationServiceTest`, `BudgetGuardrailServiceTest`.

### [x] E21-5 Gateway 흐름 통합

- 목표: provider call 전에 reserve, 종료 후 settle/release가 되도록 바꾼다.
- 범위: primary, failover, blocked, timeout, unexpected exception 경로.
- 완료 조건: 예약 성공한 요청만 provider call을 수행한다.
- 검증: `GatewayChatServiceUnitTest`, `BudgetReservationEstimatorTest`, `BudgetReservationServiceTest`, `BudgetGuardrailServiceTest`.

### [x] E21-6 TTL 복구 작업 도입

- 목표: orphan reservation을 자동 복구한다.
- 범위: sweeper job, expire 정책, 메트릭 추가.
- 완료 조건: stale reservation이 일정 시간 후 반환된다.
- 검증: `BudgetReservationServiceTest`, `BudgetReservationRecoveryJobTest`, `GatewayChatServiceUnitTest`.

### [x] E21-7 관측성 보강

- 목표: 운영자가 reservation 상태를 관측할 수 있게 한다.
- 범위: metrics, log fields, fail reason 정리.
- 완료 조건: reserve/settle/release/expire 이벤트가 메트릭으로 보인다.
- 검증: `BudgetReservationMetricsTest`, `BudgetReservationServiceTest`, `BudgetReservationRecoveryJobTest`, `GatewayChatServiceUnitTest`.

### [ ] E21-8 동시성 테스트 확대

- 목표: hard-limit 일관성을 자동 테스트로 고정한다.
- 범위: repository concurrency test, integration test, failover + reservation test.
- 완료 조건: 같은 scope에서 허용 수만 통과하고 나머지는 차단된다.
- 검증: targeted gradle tests.

### [ ] E21-9 문서 동기화

- 목표: 구현 변경이 제품/DB/API 문서에 반영되게 한다.
- 범위: `.ai/features.md`, `.ai/api-implemented.md`, `.ai/database.md`, `.ai/tasklist.md`.
- 완료 조건: hard-limit 설명이 `사전 예약 + 사후 정산` 기준으로 정렬된다.
- 검증: 문서 리뷰.

## 16) 테스트 전략

### 16-1) Repository 단위 테스트

1. reserve 성공
2. reserve 실패
3. 동시에 2건 reserve 시 1건만 성공
4. settle 시 reserved 감소 + spent 증가
5. release 시 reserved 감소
6. 이미 정산된 reservation에 중복 settle 호출 시 무해함

### 16-2) Service 테스트

1. estimator가 effective max tokens override를 반영하는지
2. unknown model이 fail-closed 되는지
3. soft-limit가 `spent + reserved` 기준으로 degrade 되는지
4. expire sweeper가 stale reservation만 처리하는지

### 16-3) Gateway 테스트

1. hard-limit 초과면 provider call 0회
2. primary blocked 시 secondary reservation 성공이면 failover 진행
3. primary 실패 후 secondary 재예약 경로
4. timeout 시 release 수행
5. unexpected exception 시 release 누락이 없는지

### 16-4) 동시성 통합 테스트

핵심 회귀 시나리오:

1. 남은 예산이 요청 1건분일 때 동시 2요청
2. 결과: 정확히 1건만 reserve 성공
3. 다른 1건은 budget blocked

이 테스트가 이번 변경의 핵심 acceptance criteria다.

## 17) 운영 메트릭 및 로그

추가 메트릭 제안:

1. `gateway_budget_reserve_total`
2. `gateway_budget_reserve_failed_total`
3. `gateway_budget_settle_total`
4. `gateway_budget_release_total`
5. `gateway_budget_reservation_expired_total`
6. `gateway_budget_reserved_usd`

추가 로그 필드 제안:

1. `budget_reserved_usd`
2. `budget_settled_usd`
3. `budget_reservation_status`
4. `budget_reservation_release_reason`

운영상 확인하고 싶은 질문은 아래와 같습니다.

1. budget blocked가 실제 정책 차단 때문인지 pricing 미상 때문인지
2. reservation 누수가 없는지
3. failover가 budget 때문인지 provider 장애 때문인지
4. 특정 provider/model이 과도하게 큰 reserve amount를 유발하는지

## 18) 리스크와 대응

### 리스크 1. 상한 계산이 너무 보수적일 수 있음

영향:

1. 실제보다 큰 금액이 오래 예약되어 throughput이 떨어질 수 있다.

대응:

1. 초기에는 안전 우선으로 보수적 계산
2. 실제 settle 비용과 reserve 비용 차이를 메트릭으로 모니터링
3. 이후 모델별 safety margin 튜닝

### 리스크 2. provider별 과금 규칙 차이

영향:

1. 계산 오차가 생길 수 있다.

대응:

1. 1차는 현재 `ModelPricing` 기준으로 통일
2. 오차가 큰 provider는 개별 estimation policy로 분리

### 리스크 3. reservation orphan

영향:

1. reserved 금액이 반환되지 않으면 false block 발생

대응:

1. TTL + sweeper
2. idempotent release/settle
3. warning metric과 운영 알람

### 리스크 4. migration 후 코드 미반영 상태

영향:

1. `reserved_cost_usd` 추가만 되고 예약 로직이 미완성이면 문서와 동작이 어긋날 수 있다.

대응:

1. feature toggle 또는 순차 배포
2. migration과 service wiring을 같은 배포 단위로 묶기

## 19) 비관적 락과 Redis를 채택하지 않은 이유

### 비관적 락 비채택 이유

1. `SELECT ... FOR UPDATE`는 직관적이지만 LLM 호출처럼 긴 외부 I/O와 결합되면 위험하다.
2. 트랜잭션/커넥션 유지 시간이 길어져 connection pool exhaustion 가능성이 커진다.
3. tail latency가 커지고 장애 시 대기가 연쇄적으로 늘어날 수 있다.

### Redis 비채택 이유

1. 현재 인프라에 Redis가 없다.
2. 예산 정책, usage, request log를 같은 저장소에서 추적하는 편이 운영상 단순하다.
3. Redis + Postgres 이중 정합성 문제까지 함께 관리할 필요가 생긴다.
4. 현재 규모에서는 Postgres 원자적 예약-정산이 더 실용적이다.

## 20) 구현 대상 파일 초안

예상 변경 파일:

1. `src/main/resources/db/migration/V__...sql`
2. `src/main/java/com/llm_ops/demo/budget/domain/BudgetMonthlyUsage.java`
3. `src/main/java/com/llm_ops/demo/budget/domain/BudgetReservation.java`
4. `src/main/java/com/llm_ops/demo/budget/repository/BudgetMonthlyUsageRepository.java`
5. `src/main/java/com/llm_ops/demo/budget/repository/BudgetReservationRepository.java`
6. `src/main/java/com/llm_ops/demo/budget/service/BudgetReservationService.java`
7. `src/main/java/com/llm_ops/demo/budget/service/BudgetReservationEstimator.java`
8. `src/main/java/com/llm_ops/demo/budget/service/BudgetGuardrailService.java`
9. `src/main/java/com/llm_ops/demo/gateway/service/GatewayChatService.java`
10. `src/main/java/com/llm_ops/demo/gateway/service/GatewayMetrics.java`
11. 관련 단위/통합 테스트

## 21) 구현 후 검증 명령 초안

```bash
./gradlew test \
  --tests "com.llm_ops.demo.budget.*" \
  --tests "com.llm_ops.demo.gateway.service.GatewayChatServiceUnitTest"

./gradlew clean test
```

필요 시 로컬 부하/동시성 검증은 별도 시나리오로 추가합니다.

## 22) ADR

### 제목

Postgres 원자적 예약-정산 기반 Gateway 예산 Hard-limit 동시성 제어 도입

### 상태

Proposed

### 문맥

현재 Gateway hard-limit는 호출 전 월 누적 비용을 조회하고, 호출 성공 후 실제 비용을 누적하는 구조다. 이 방식은 구현이 단순하지만 동시 요청 환경에서 여러 요청이 동일한 사용량을 읽고 함께 통과할 수 있어 hard-limit 일관성이 깨질 수 있다. 또한 기존 월 사용량 row 갱신은 atomic increment 쿼리가 아니라 entity 누적 방식이라 lost update 위험이 존재한다.

우리 시스템은 PostgreSQL을 이미 사용하고 있고 Redis는 도입되어 있지 않다. LLM 호출은 느린 외부 I/O이며 응답 시간이 길 수 있으므로, 비관적 락을 호출 구간 전체에 유지하는 방식은 DB 커넥션 풀 고갈과 대기 시간 증가를 유발할 가능성이 높다. 운영 가시성과 복구 용이성도 중요한 요구사항이므로, 예산 상태와 요청 로그를 같은 저장소 안에서 일관되게 추적할 수 있는 방식이 필요하다.

### 결정

Gateway hard-limit는 PostgreSQL 기반 원자적 예약-정산 방식으로 구현한다.

1. 요청 시작 시 최대 가능 비용 상한을 계산한다.
2. 짧은 트랜잭션에서 `budget_monthly_usage.reserved_cost_usd`를 조건부 증가시켜 예약한다.
3. 예약 성공한 요청만 provider call을 수행한다.
4. 호출 종료 후 실제 비용을 `cost_usd`에 반영하고, 남은 예약액은 반환한다.
5. 실패/timeout/예외 시 예약을 반환한다.
6. 요청 중단으로 누락된 reservation은 TTL 기반 sweeper가 복구한다.

### 결정 상세

1. hard-limit 승인 조건은 `spent + reserved + reserveAmount <= monthLimit`로 정의한다.
2. soft-limit degrade는 `spent + reserved` 기준으로 평가한다.
3. 예약 금액은 평균 예상치가 아니라 최대 가능 비용 상한으로 계산한다.
4. 모델 단가를 모르면 hard-limit는 fail-closed 한다.
5. primary와 secondary failover는 서로 다른 provider/model 예산 경로로 보며, failover 시 새 reservation을 생성한다.

### 장점

1. Redis 없이도 strong-enough hard-limit 일관성을 확보할 수 있다.
2. LLM 호출 시간 동안 트랜잭션/락/커넥션을 유지하지 않는다.
3. 예산, reservation, 로그를 PostgreSQL에서 함께 추적할 수 있다.
4. 운영 장애 분석과 감사 추적이 단순해진다.

### 단점

1. 도메인과 스키마가 복잡해진다.
2. stale reservation 복구와 idempotent 정산 로직이 필요하다.
3. 상한 계산이 보수적이면 예산이 과하게 묶일 수 있다.
4. provider 과금 체계를 100% 실시간으로 재현하지는 못한다.

### 검토한 대안

#### 대안 1. 현행 사후 누적 유지

장점:

1. 구현이 단순하다.

단점:

1. 동시 요청 hard-limit 일관성을 보장하지 못한다.

결론:

기각

#### 대안 2. DB 비관적 락

장점:

1. 구현 개념이 직관적이다.

단점:

1. LLM 호출처럼 느린 외부 I/O와 결합되면 커넥션 풀 고갈 위험이 크다.
2. 대기 시간이 길어지고 tail latency가 악화된다.

결론:

기각

#### 대안 3. DB 낙관적 락

장점:

1. 락을 오래 쥐지 않는다.

단점:

1. hot row에서 충돌과 재시도가 증가할 수 있다.
2. 예약 개념을 명확하게 표현하기 어렵다.

결론:

주 방식으로 채택하지 않음

#### 대안 4. Redis 예약-정산

장점:

1. 높은 처리량과 빠른 원자 연산

단점:

1. 새 인프라가 필요하다.
2. Redis와 Postgres 간 정합성 관리가 추가된다.

결론:

현 시점 보류

### 결과

1. 구현 복잡도는 증가하지만, 현재 스택과 운영 요구사항을 고려하면 가장 균형이 좋다.
2. 1차 적용은 provider credential hard-limit에 우선 도입한다.
3. 안정화 후 workspace hard-limit까지 동일 엔진으로 확장한다.

## 23) 팀 공유용 요약

```text
Gateway hard-limit는 단순 조회 후 사후 누적 방식으로는 동시 요청 일관성을 보장하기 어렵습니다.
이를 해결하기 위해 Postgres에서 요청 시작 시 최대 비용 상한을 먼저 예약하고,
호출 종료 후 실제 비용만 확정 반영하는 예약-정산 구조로 전환합니다.
이 방식은 Redis 없이도 hard-limit를 더 강하게 보장하면서,
LLM 호출 동안 DB 락/커넥션을 오래 잡지 않아 운영 안정성도 유지할 수 있습니다.
```
