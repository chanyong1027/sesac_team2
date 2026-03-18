# Prompt Eval Parallelization Plan

## 1. 목적

- Prompt Eval의 비동기 enqueue 구조는 유지하되, 실제 실행부를 제한된 병렬 처리 구조로 재설계한다.
- 여러 사용자가 동시에 Eval을 실행해도 `Created -> Completed` 지연이 선형으로 늘어나지 않도록 한다.
- 단일 인스턴스뿐 아니라 향후 다중 인스턴스 환경에서도 안전하게 동작하는 상태 전이와 claim 구조를 만든다.
- 외부 LLM provider의 rate limit, 비용 급증, DB 경합을 통제 가능한 범위 안에서 병렬성을 높인다.

## 2. 현재 문제 요약

- `POST /eval/runs`는 빠르게 enqueue되지만 실제 처리는 워커가 순차 실행한다.
- 워커는 run 여러 개를 한 번에 `RUNNING`으로 선점하지만, 실제 실행은 순차라 `startedAt`이 실제 compute 시작 시각을 정확히 반영하지 못한다.
- run 내부에서도 case를 `for` 루프로 하나씩 처리한다.
- 현재 구조에서는 queue 적체가 커질수록 뒤 run의 완료 시간이 크게 증가한다.
- case 완료마다 run 엔티티 카운터를 직접 갱신하는 방식은 병렬 case 실행 시 lost update 위험이 있다.

### 변경 전 기준선

아래 수치는 병렬화 전 기준선으로 유지하며, 변경 후 반드시 같은 조건으로 재측정해 비교한다.

- 단건 평균 완료 시간: `32.988s`
- 3건 enqueue 후 평균 완료 시간: `62.488s`
- 3건 enqueue 후 최대 완료 시간: `96.569s`
- queue 대기 평균: `22.331s`
- API 응답 평균: `30.3ms`

기준 시나리오:

- 단건 baseline: 5-case run 기준 3회 반복
- enqueue burst: `arrivalRate = 1 rps`, `duration = 3s`, 총 3건 생성
- 측정 기준: `Created -> Completed`, `Created -> Started`, HTTP 응답 시간

## 3. 최종 목표 구조

```text
HTTP createRun
-> DB enqueue (run=QUEUED, cases=QUEUED)
-> Dispatcher poll
-> DB claim (QUEUED -> CLAIMED)
-> Run Executor submit
-> actual start (CLAIMED -> RUNNING)
-> Case tasks submit to global case executor
-> Provider limiter acquire
-> candidate / baseline / judge calls
-> case result persist
-> run summary + overall review
-> COMPLETED / FAILED / CANCELLED
```

핵심 원칙:

- HTTP 요청은 계속 짧게 끝낸다.
- 큐는 유지하되, 실행은 제한된 병렬 처리로 바꾼다.
- 병렬성은 `run-level`, `case-level`, `provider-level` 3단계에서 각각 제한한다.
- 상태값과 timestamp는 "실제 상태"를 정확히 반영해야 한다.

## 4. 상태 모델 재설계

### Run 상태

기존:

- `QUEUED`
- `RUNNING`
- `COMPLETED`
- `FAILED`
- `CANCELLED`

변경:

- `QUEUED`
- `CLAIMED`
- `RUNNING`
- `CANCEL_REQUESTED`
- `COMPLETED`
- `FAILED`
- `CANCELLED`

### 상태 의미

- `QUEUED`: 아직 어떤 실행기에도 할당되지 않음
- `CLAIMED`: 실행 슬롯은 확보했지만 실제 run compute는 아직 시작되지 않음
- `RUNNING`: 실제 run 처리 시작, timeout 기준 시각도 이때부터 계산
- `CANCEL_REQUESTED`: 실행 중 취소 요청 수신, 새 case 스케줄링 중단
- `COMPLETED` / `FAILED` / `CANCELLED`: 종료 상태

### timestamp/lease 필드

`eval_runs`에 아래 필드 추가를 권장한다.

- `claimed_at`
- `lease_owner`
- `lease_expires_at`
- `last_heartbeat_at`
- `cancel_requested_at`

의미:

- `started_at`: 실제 run compute 시작 시각
- `claimed_at`: dispatcher가 실행 슬롯을 예약한 시각
- `lease_expires_at`: 프로세스 장애 시 stale claim/run을 회수하기 위한 만료 시각
- `last_heartbeat_at`: 실행기가 살아 있는지 확인하기 위한 heartbeat 시각

## 5. 큐와 워커 구조 재설계

### 5.1 Dispatcher 도입

현재 `EvalWorker`의 역할을 둘로 분리한다.

- `EvalRunDispatcher`
- `EvalRunExecutionService`

`EvalRunDispatcher`의 책임:

- 주기적으로 큐를 확인
- 현재 실행 가능 슬롯 수 계산
- 그 수만큼만 run claim
- claim된 run을 run executor에 제출

중요:

- 더 이상 `batchSize=3`처럼 고정 개수 선점이 아니라, `executor 남은 슬롯 수` 기준으로 claim한다.
- `CLAIMED`만 하고 실제 `RUNNING` 전환은 executor 스레드가 일을 시작할 때 수행한다.

### 5.2 안전한 claim 방식

현재의 `PESSIMISTIC_WRITE + saveAll` 패턴 대신, PostgreSQL 기준으로 `SKIP LOCKED` 성격의 claim 로직을 사용한다.

목표:

- 여러 dispatcher 스레드 또는 여러 서버 인스턴스가 동시에 떠도 같은 run을 중복 claim하지 않음
- queue head blocking 최소화
- stale `CLAIMED`/`RUNNING` run만 재회수 가능

권장 구현:

- native query 또는 DB 친화적 claim repository 메서드 추가
- 한 트랜잭션 안에서 `QUEUED -> CLAIMED` 전이와 lease 정보 업데이트 수행

## 6. 병렬 실행 모델

### 6.1 Run-level 병렬화

고정 크기 `RunExecutor`를 도입한다.

권장 설정 예시:

- `eval.worker.max-concurrent-runs = 3~4`
- `eval.worker.dispatch-interval-ms = 500~1000`

역할:

- 동시에 여러 run을 병렬 실행
- 하지만 무제한 실행은 금지
- 인스턴스 전체의 run-level concurrency를 명시적으로 제어

### 6.2 Case-level 병렬화

run 하나 안에서도 case를 병렬 처리한다.

권장 구조:

- 전역 `CaseExecutor`는 bounded pool
- 각 run은 `maxConcurrentCasesPerRun` 만큼만 case task를 제출
- 제출 후 `CompletionService` 또는 유사 구조로 완료된 case를 수집

권장 설정 예시:

- `eval.execution.max-concurrent-cases-per-run = 2~4`
- `eval.execution.max-active-cases-global = 8~16`

중요:

- run마다 별도 thread pool을 만들지 않는다.
- 전역 bounded case executor + per-run concurrency gate 구조가 더 안정적이다.

### 6.3 Provider-level 제한

case를 병렬화하면 candidate, baseline, judge 호출이 한 번에 몰린다.
따라서 provider/model별 concurrency limiter가 필요하다.

권장 정책:

- `OPENAI`, `ANTHROPIC`, `GEMINI`별 permit 제한
- 필요 시 `provider + role(candidate/judge)` 기준 분리
- limiter 획득 전에는 외부 API 호출 금지

권장 설정 예시:

- `eval.runner.provider-limits.openai.max-concurrent-calls = 6`
- `eval.runner.provider-limits.anthropic.max-concurrent-calls = 3`
- `eval.runner.provider-limits.gemini.max-concurrent-calls = 3`

## 7. 서비스 책임 재구성

### 유지

- `EvalRunService`
  - enqueue
  - run 조회
  - cancel 요청
  - recovery 진입점

### 분리/추가

- `EvalRunDispatcher`
  - poll
  - claim
  - run executor submit

- `EvalRunExecutionService`
  - run 시작
  - case scheduling
  - finalization

- `EvalCaseExecutionService`
  - case 1건 처리
  - candidate/baseline/judge 호출
  - case 상태 저장

- `EvalProviderConcurrencyLimiter`
  - provider별 permit 획득/반납

- `EvalRunLeaseService`
  - heartbeat 갱신
  - stale claim / stale running 회수

현재의 `EvalExecutionService`는 orchestration/finalization 중심으로 축소하고, case 실행 상세 로직은 별도 서비스로 떼어내는 것이 좋다.

## 8. 트랜잭션과 데이터 정합성

병렬화를 하려면 긴 트랜잭션을 피해야 한다.

원칙:

- run orchestration과 case 실행을 같은 트랜잭션에 묶지 않는다.
- case 1건은 자체 트랜잭션으로 실행하고 저장한다.
- run 최종 summary는 모든 case 종료 후 별도 트랜잭션에서 계산한다.

### run 카운터 갱신 방식 변경

현재처럼 `run.onCaseOk()` / `run.onCaseError()`로 run 엔티티 카운터를 직접 올리는 방식은 병렬 실행 시 위험하다.

대안:

- 방법 A: repository 레벨 atomic increment 쿼리 사용
- 방법 B: case 결과 집계 쿼리를 source of truth로 사용

최적안 기준 권장:

- 진행률 표시는 집계 쿼리 기반으로 계산
- run 완료 시 summary도 case 결과 집계 기반으로 계산
- 필요하면 화면 응답용 캐시 필드만 별도 업데이트

## 9. 취소와 복구 정책

### 취소

`cancelRun()` 동작을 두 단계로 나눈다.

- `QUEUED` / `CLAIMED`: 즉시 `CANCELLED`
- `RUNNING`: `CANCEL_REQUESTED`로 전환

`CANCEL_REQUESTED` 상태에서는:

- 새 case 제출 중단
- 아직 시작하지 않은 case는 `QUEUED` 유지 또는 `CANCELLED` 처리 정책 결정
- 이미 진행 중인 provider 호출은 즉시 강제 중단이 안 될 수 있으므로 cooperative cancel 방식 사용

### 복구

startup recovery만으로는 부족하다.

추가 정책:

- `CLAIMED`인데 lease 만료된 run은 `QUEUED`로 복구
- `RUNNING`인데 heartbeat/lease 만료된 run은 실행 중단으로 판단하고 복구
- `RUNNING` case는 `QUEUED`로 되돌리고 부분 결과 초기화

## 10. Summary / Release Decision 처리

모든 case가 끝난 뒤에만 run finalization을 수행한다.

finalization 단계:

- case 결과 aggregate 조회
- `avgOverallScore`, `passRate`, `errorRate`, compare coverage 계산
- `releaseDecision` 계산
- performance summary 계산
- top issues 계산
- `llmOverallReview` 생성
- 최종 `COMPLETED` 또는 `FAILED` 저장

주의:

- finalization은 정확히 한 번만 실행되어야 한다.
- 동일 run에 대해 중복 finalization이 발생하지 않도록 terminal transition 보호가 필요하다.

## 11. 설정 변경안

기존:

- `eval.worker.poll-interval-ms`
- `eval.worker.batch-size`

권장 변경:

- `eval.worker.dispatch-interval-ms`
- `eval.worker.max-concurrent-runs`
- `eval.worker.claim-batch-size`
- `eval.execution.max-concurrent-cases-per-run`
- `eval.execution.max-active-cases-global`
- `eval.execution.claim-lease-seconds`
- `eval.execution.run-lease-seconds`
- `eval.execution.heartbeat-interval-seconds`
- `eval.runner.provider-limits.*.max-concurrent-calls`

기존 `run-timeout-minutes`, `request-timeout-ms`, `same-provider-retry-*`는 유지한다.

## 12. 코드 변경 범위

### Domain / Enum

- `EvalRunStatus`
- `EvalRun`

### Repository

- `EvalRunRepository`
- 필요 시 progress aggregate query repository 추가

### Service

- `EvalRunService`
- `EvalExecutionService`
- 신규 `EvalRunDispatcher`
- 신규 `EvalRunExecutionService`
- 신규 `EvalCaseExecutionService`
- 신규 `EvalProviderConcurrencyLimiter`
- 신규 `EvalRunLeaseService`

### Config

- `EvalProperties`
- executor / scheduler bean 설정

### DB / Migration

- `eval_runs` 컬럼 추가
- 상태값 확장
- queue/lease 조회용 인덱스 추가

### Tests

- worker/dispatcher 동작 테스트
- claim 중복 방지 테스트
- case 병렬 처리 테스트
- cancel / recovery 테스트
- provider limiter 테스트
- summary 정확성 테스트

## 13. 구현 단계

### Phase 1. 상태/스키마 정비

- `CLAIMED`, `CANCEL_REQUESTED` 상태 추가
- lease/heartbeat 관련 컬럼 추가
- `startedAt` 의미를 실제 compute start로 재정의

### Phase 2. Dispatcher + Run Executor

- 현재 `EvalWorker`를 dispatcher 역할로 축소
- run executor 도입
- 안전한 claim 로직 구현

### Phase 3. Case 실행 분리

- `processCase()`를 별도 서비스로 추출
- case 1건 단위 트랜잭션 분리

### Phase 4. Case-level 병렬화

- 전역 case executor 도입
- per-run concurrency gate 추가
- case futures 수집 구조 도입

### Phase 5. Provider limiter

- provider/model별 semaphore 또는 limiter 추가
- 설정값 외부화

### Phase 6. 취소/복구/heartbeat

- `CANCEL_REQUESTED` 처리
- stale lease recovery
- heartbeat 주기 갱신

### Phase 7. 메트릭/가시성

- queue wait
- claim wait
- actual run duration
- active runs
- active cases
- provider permit usage
- judge retry count

### Phase 8. 재벤치마크

- 단건 baseline 재측정
- 3건, 5건, 10건 enqueue burst 재측정
- provider 429/error rate 확인
- 비용 증가 추이 확인
- 기존 기준선과 아래 항목을 직접 비교
- 단건 평균 완료 시간: `32.988s`
- 3건 enqueue 후 평균 완료 시간: `62.488s`
- 3건 enqueue 후 최대 완료 시간: `96.569s`
- queue 대기 평균: `22.331s`
- API 응답 평균: `30.3ms`
- 동일한 시나리오 조건을 유지한 상태에서 개선 폭을 기록

## 14. 검증 항목

기능 검증:

- 동시에 여러 run이 실제 병렬 실행된다
- 동일 run이 중복 claim되지 않는다
- `startedAt`은 실제 실행 시작 시각이다
- `COMPARE_ACTIVE`에서도 compare summary가 정상 저장된다
- cancel 요청 시 새 case가 더 이상 시작되지 않는다
- 앱 재시작 후 stale claim/run이 복구된다

성능 검증:

- 단건 평균 완료 시간이 기존 `32.988s` 대비 악화되지 않거나 허용 범위 내로 유지된다
- 3건 burst에서 평균 완료 시간이 기존 `62.488s` 대비 유의미하게 감소한다
- 3건 burst에서 최대 완료 시간이 기존 `96.569s` 대비 유의미하게 감소한다
- queue wait 평균이 기존 `22.331s` 대비 유의미하게 감소한다
- API 응답 평균은 기존 `30.3ms` 수준을 크게 해치지 않는다
- queue wait 비중이 줄어든다
- provider 429 비율이 허용 범위 안에 있다
- DB/Hikari/thread pool이 포화되지 않는다

## 15. 리스크와 대응

- 리스크: 병렬 case 처리로 provider 429 증가
  - 대응: provider limiter, same-provider retry, 초기 보수적 concurrency

- 리스크: run 카운터 경합으로 summary 오염
  - 대응: case 결과 aggregate 기반 계산으로 전환

- 리스크: cancel 직후 일부 in-flight 호출은 끝까지 수행될 수 있음
  - 대응: cooperative cancel 정책을 명시하고 UI에도 반영

- 리스크: lease/heartbeat 버그로 run 중복 실행
  - 대응: claim/finalization/cancel race 조건 테스트 강화

- 리스크: 병렬화 후 비용이 짧은 시간에 급증
  - 대응: global/provider concurrency 상한, 운영 기본값 보수 설정

## 16. 권장 기본값 초안

운영 첫 배포 기준 보수적 시작값:

- `max-concurrent-runs = 3`
- `max-concurrent-cases-per-run = 2`
- `max-active-cases-global = 6`
- `openai.max-concurrent-calls = 4`
- `dispatch-interval-ms = 1000`

`2 -> 3 -> 4` 재벤치마크 결과, 현재 limiter 조합에서는 `3`이 가장 균형이 좋았다.

## 17. 결론

최적안의 핵심은 "무제한 병렬화"가 아니라 "정확한 상태 모델과 제한된 병렬 실행 구조"다.

따라서 구현 방향은 아래 한 줄로 정리된다.

- 큐는 유지하고, `CLAIMED -> RUNNING`을 분리한 뒤, run-level / case-level / provider-level 병렬성을 각각 통제 가능한 구조로 재설계한다.

## 18. 구현 및 재측정 결과 (2026-03-18)

### 구현 반영 상태

- `EvalRunStatus`에 `CLAIMED`, `CANCEL_REQUESTED`를 추가했다.
- `EvalWorker`는 queued run을 claim하고 executor에 제출하는 dispatcher 역할로 축소했다.
- run-level bounded executor와 case-level bounded executor를 도입했다.
- provider별 semaphore 기반 동시성 제한을 추가했다.
- `cancelRun()`은 `QUEUED/CLAIMED`에서는 즉시 `CANCELLED`, 실행 중에는 `CANCEL_REQUESTED`로 처리하도록 정리했다.
- lease/heartbeat/recovery를 위한 `eval_runs` 컬럼과 인덱스를 `V32__eval_parallel_execution_state.sql`로 추가했다.

### 적용 확인

- Flyway `V32` migration 적용 완료
- 스모크 E2E 확인 완료
  - `run 216`: 정상 생성 후 `COMPLETED`
  - `run 217`: 생성 직후 취소 후 `CANCELLED`

### 재측정 결과

단건 baseline:

- 평균 완료 시간: `22.418s`
- 최대 완료 시간: `23.881s`
- 평균 queue 대기: `1.329s`
- 평균 API 응답: `84.5ms`
- 평균 비용: `$0.004990 / run`

3건 enqueue burst:

- 평균 완료 시간: `44.115s`
- 최대 완료 시간: `56.666s`
- 평균 queue 대기: `12.780s`
- 평균 API 응답: `43.3ms`
- 평균 비용: `$0.005014 / run`

기준선 대비:

- 단건 평균 완료 시간: `32.988s -> 22.418s` (`-32.0%`)
- 3건 burst 평균 완료 시간: `62.488s -> 44.115s` (`-29.4%`)
- 3건 burst 최대 완료 시간: `96.569s -> 56.666s` (`-41.3%`)
- 평균 queue 대기: `22.331s -> 12.780s` (`-42.8%`)

### 남은 병목

- 초기 재측정 기준 `max-concurrent-runs = 2`에서는 3건 burst 시 세 번째 run 대기가 컸다.
- 후속 튜닝 결과 `max-concurrent-runs = 3`이 현재 limiter 조합에서 가장 안정적이었다.
- 이제 주요 병목은 run 슬롯보다 `max-active-cases-global = 6`과 `openai-max-concurrent-calls = 4` 쪽으로 이동했다.

### 후속 튜닝 결과 (`max-concurrent-runs` 3 vs 4)

3건 burst:

- `max=3`: 평균 queue `2.738s`, 평균 완료 `21.520s`, 최대 완료 `22.852s`
- `max=4`: 평균 queue `2.329s`, 평균 완료 `22.053s`, 최대 완료 `23.489s`

5건 burst:

- `max=3`: 평균 queue `8.178s`, 평균 완료 `23.532s`, 최대 완료 `32.126s`
- `max=4`: 평균 queue `6.143s`, 평균 완료 `26.016s`, 최대 완료 `35.459s`

판단:

- `2 -> 3`은 큰 개선이다.
- `3 -> 4`는 queue wait 일부만 줄이고 completion은 악화됐다.
- 따라서 현재 기본 운영값은 `max-concurrent-runs = 3`으로 두는 것이 적절하다.

### 다음 튜닝 순서

- `max-concurrent-cases-per-run` 상향 시 provider 429 / 비용 추이 재측정
- `max-active-cases-global`과 provider permit 동시 상향 여부 검토
- 동일 시나리오로 `10건` burst 추가 측정
