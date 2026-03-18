# Prompt Eval Benchmark (2026-03-18)

## 1. 목적

- 현재 `develop` 기준 Prompt Eval 실행 경로의 성능 baseline을 확보한다.
- 병렬 처리 적용 전, 여러 사용자가 동시에 Eval 실행을 요청했을 때 queue 적체가 얼마나 커지는지 확인한다.
- 이력서/면접 답변용으로 환경, 부하 조건, 해석 기준을 명시 가능한 수치를 남긴다.

## 2. 전제와 주의

- 이 문서는 `Gateway` 부하 테스트 결과가 아니라 `Prompt Eval` 실행 경로 측정 결과다.
- 이번 측정은 `Prompt Eval` 기준이다. `POST /eval/runs`는 비동기 enqueue API이고, 실제 평가는 Worker가 백그라운드에서 처리한다.
- 서버는 `prod,test-perf` 프로필로 실행했지만, `Prompt Eval`은 `test-perf`의 Gateway stub을 사용하지 않는다.
  - `test-perf` stub은 Gateway용 `ChatModel` 대체 구성이다.
  - Prompt Eval은 `EvalModelRunnerService`에서 실제 provider API를 직접 호출한다.
- 따라서 이번 측정에는 실제 OpenAI API 호출 비용이 포함된다.

## 3. 측정 환경

- OS: macOS 26.1
- CPU: Apple M4
- Memory: 16GB
- Backend: Spring Boot, `http://localhost:8081`
- DB: Docker PostgreSQL (`localhost:5433`)
- Object Storage: Docker MinIO (`localhost:9000-9001`)
- Candidate model: `OPENAI / gpt-4.1-mini`
- Judge model: `OPENAI / gpt-4.1-mini`
- Eval mode: `CANDIDATE_ONLY`
- Rubric: `SUMMARY`
- Prompt: no-RAG 요약 프롬프트
- Dataset: 5 cases
- Worker 설정:
  - `eval.worker.poll-interval-ms = 3000`
  - `eval.worker.batch-size = 3`

## 4. 현재 코드 기준 병목 위치

- Worker는 3초마다 queue를 polling 한다.
- Worker는 queue에서 run을 꺼낸 뒤 `EvalExecutionService.processRun()`을 호출한다.
- `processRun()` 내부에서 case 목록을 `for` 루프로 순차 처리한다.
- `pickQueuedRuns(batchSize=3)`는 최대 3개 run을 한 번에 `RUNNING`으로 마킹한다.

즉, 현재 구조는:

1. `POST /eval/runs` 요청 자체는 빠르게 수신한다.
2. 실제 Prompt Eval 처리 throughput은 낮다.
3. 여러 run이 동시에 들어오면 실패하기보다 queue 대기 시간이 커진다.

## 5. 측정 대상

### 공통 조건

- 프롬프트 버전: `gpt-4.1-mini`, `temperature=0.0`, `maxOutputTokens=120`
- Dataset: 5건
- test case 유형: 한국어 요약 1문장 생성
- 평가 mode: `CANDIDATE_ONLY`
- 평가 rubric: `SUMMARY`

### 테스트 케이스 수

- 각 run은 5 cases를 처리한다.
- Judge 재시도 설정은 기본값을 따른다.
  - `rejudge-on-fail = true`
  - `max-attempts = 2`

## 6. 사전 Estimate 결과

`POST /eval/runs:estimate` 기준:

- estimated calls: `11 ~ 16`
- estimated tokens: `2701 ~ 6214`
- estimated cost: `$0.002280 ~ $0.006662`
- estimated duration: `16.5s ~ 44.8s`

실측 비용은 run당 약 `$0.0052 ~ $0.0054` 수준으로 estimate 범위 안에 들어왔다.

## 7. 시나리오 A: 단일 run baseline

### 부하 조건

- 동시 run 수: `1`
- 방식: 한 run이 완료된 뒤 다음 run을 생성
- 반복 횟수: 3회

### 결과

| Run ID | Created -> Started (s) | Started -> Completed (s) | Created -> Completed (s) | Total Cost (USD) |
| --- | ---: | ---: | ---: | ---: |
| 210 | 3.067 | 30.295 | 33.362 | 0.005408 |
| 211 | 1.657 | 30.345 | 32.002 | 0.005229 |
| 212 | 2.392 | 31.209 | 33.601 | 0.005269 |

### 요약

- 평균 완료 시간 (`Created -> Completed`): `32.988s`
- 최대 완료 시간: `33.601s`
- 평균 queue 대기 (`Created -> Started`): `2.372s`
- 평균 처리 구간 (`Started -> Completed`): `30.616s`
- 평균 비용: `$0.005302 / run`

## 8. 시나리오 B: Artillery로 run enqueue 부하

### 부하 조건

- 도구: `Artillery`
- 대상 API: `POST /api/v1/workspaces/{workspaceId}/prompts/{promptId}/eval/runs`
- 부하 기준: `arrivalRate = 1 rps`, `duration = 3s`
- 총 생성 요청 수: `3`

주의:

- 이 시나리오는 `VU(동시 접속자 수)` 기준보다는 `run enqueue rate` 기준이다.
- HTTP 요청은 즉시 반환되고 실제 평가는 비동기 Worker가 수행하므로, `Prompt Eval`은 VU보다 queue 적체를 보는 것이 더 중요하다.

### Artillery API 응답 요약

- `HTTP 201`: `3/3`
- mean response time: `30.3ms`
- p95 response time: `32.8ms`
- max response time: `36ms`

즉, `POST /eval/runs` API 자체는 빠르게 응답했다.

### enqueue 이후 실제 run 결과

| Run ID | Status | Created -> Started (s) | Started -> Completed (s) | Created -> Completed (s) | Total Cost (USD) |
| --- | --- | ---: | ---: | ---: | ---: |
| 213 | COMPLETED | 0.820 | 30.747 | 31.567 | 0.005220 |
| 214 | COMPLETED | 33.585 | 25.742 | 59.327 | 0.005260 |
| 215 | COMPLETED | 32.589 | 63.980 | 96.569 | 0.005106 |

### 요약

- 평균 queue 대기 (`Created -> Started`): `22.331s`
- 최대 queue 대기: `33.585s`
- 평균 완료 시간 (`Created -> Completed`): `62.488s`
- 최대 완료 시간: `96.569s`
- 평균 비용: `$0.005195 / run`

## 9. 해석

### 9.1 API ingress는 병목이 아니다

- `POST /eval/runs` 자체는 평균 `30.3ms`로 매우 빨랐다.
- 즉 요청 접수 capacity보다, 백그라운드 Eval 처리 throughput이 현재 병목이다.

### 9.2 현재 Prompt Eval의 실질 동시 처리량은 낮다

- 단건 baseline은 약 `33초` 수준이다.
- 그러나 거의 동시에 3건을 enqueue하면 뒤 run의 완료 시간은 `59.327s`, `96.569s`까지 늘어난다.
- 현재 구조는 요청을 빠르게 받되, 실제 처리는 queue에 쌓아 순차적으로 소화하는 형태에 가깝다.

### 9.3 `startedAt` 해석에는 주의가 필요하다

- Worker는 `batchSize=3` 범위의 queued run을 한 번에 `RUNNING`으로 마킹한다.
- 따라서 `startedAt`은 "실제 compute가 시작된 시점"이라기보다 "Worker가 batch로 claim한 시점"에 가깝다.
- 여러 run이 동시에 들어온 경우, 사용자 체감 SLA는 `Started -> Completed`보다 `Created -> Completed`를 보는 것이 더 정확하다.

## 10. 결론

- 현재 `develop`의 Prompt Eval은 단건 5-case run 기준 약 `33초` 수준이다.
- 여러 사용자가 동시에 Eval 실행을 요청하면 API는 빠르게 응답하지만, queue 적체 때문에 뒤 run의 완료 시간이 크게 증가한다.
- 이번 측정에서 3건 enqueue 시 최대 완료 시간은 `96.569초`였다.
- 따라서 현재 구조의 문제는 HTTP 동시 접속 처리보다 `Eval Worker / run-case 처리 throughput`에 있다.

## 11. 후속 개선 방향

- run-level concurrency 추가
- case-level concurrency 추가
- provider별 동시성 제한 및 rate limiting
- `QUEUED / CLAIMED / RUNNING` 상태 전이 정교화
- UI에 queue position, 예상 대기 시간, cancel 흐름 노출

## 12. 병렬화 적용 후 재측정

### 적용 범위

- `QUEUED -> CLAIMED -> RUNNING` 상태 전이 분리
- bounded `run executor` / `case executor` 도입
- provider별 동시성 제한 추가
- cancel / recovery / lease 처리 보강

### 재측정 환경

- 측정 일시: `2026-03-18`
- 서버 프로필: `prod`
- Backend: Spring Boot, `http://localhost:8081`
- Candidate model: `OPENAI / gpt-4.1-mini`
- Judge model: `OPENAI / gpt-4.1-mini`
- Eval mode: `CANDIDATE_ONLY`
- Rubric: `SUMMARY`
- Dataset: 5 cases
- 실행 설정:
  - `eval.worker.poll-interval-ms = 3000`
  - `eval.worker.max-concurrent-runs = 2` (초기 재측정 시점)
  - `eval.execution.max-concurrent-cases-per-run = 2`
  - `eval.execution.max-active-cases-global = 6`
  - `eval.runner.provider-limits.openai-max-concurrent-calls = 4`

주의:

- 병렬화 후 재측정은 `prod` 프로필로 수행했다.
- 초기 기준선은 `prod,test-perf`로 수행했지만, Prompt Eval은 Gateway stub을 사용하지 않고 `EvalModelRunnerService`에서 provider를 직접 호출하므로 비교 축은 유지된다.

## 13. 시나리오 C: 병렬화 후 단일 run baseline

### 부하 조건

- 동시 run 수: `1`
- 방식: 한 run이 완료된 뒤 다음 run을 생성
- 반복 횟수: 3회

### 결과

| Run ID | HTTP Create (ms) | Created -> Started (s) | Started -> Completed (s) | Created -> Completed (s) | Total Cost (USD) |
| --- | ---: | ---: | ---: | ---: | ---: |
| 218 | 159.7 | 0.687 | 23.194 | 23.881 | 0.004934 |
| 219 | 61.8 | 2.949 | 19.901 | 22.850 | 0.005015 |
| 220 | 31.9 | 0.351 | 20.172 | 20.523 | 0.005021 |

### 요약

- 평균 API 응답: `84.5ms`
- 평균 queue 대기 (`Created -> Started`): `1.329s`
- 평균 처리 구간 (`Started -> Completed`): `21.089s`
- 평균 완료 시간 (`Created -> Completed`): `22.418s`
- 최대 완료 시간: `23.881s`
- 평균 비용: `$0.004990 / run`

## 14. 시나리오 D: 병렬화 후 Artillery run enqueue 부하

### 부하 조건

- 도구: `Artillery`
- 대상 API: `POST /api/v1/workspaces/{workspaceId}/prompts/{promptId}/eval/runs`
- 부하 기준: `arrivalRate = 1 rps`, `duration = 3s`
- 총 생성 요청 수: `3`

### Artillery API 응답 요약

- `HTTP 201`: `3/3`
- mean response time: `43.3ms`
- p95 response time: `36.2ms`
- max response time: `64ms`

### enqueue 이후 실제 run 결과

| Run ID | Status | Created -> Started (s) | Started -> Completed (s) | Created -> Completed (s) | Total Cost (USD) |
| --- | --- | ---: | ---: | ---: | ---: |
| 221 | COMPLETED | 1.744 | 36.004 | 37.748 | 0.004951 |
| 222 | COMPLETED | 0.774 | 37.157 | 37.931 | 0.004989 |
| 223 | COMPLETED | 35.821 | 20.845 | 56.666 | 0.005103 |

### 요약

- 평균 queue 대기 (`Created -> Started`): `12.780s`
- 최대 queue 대기: `35.821s`
- 평균 완료 시간 (`Created -> Completed`): `44.115s`
- 최대 완료 시간: `56.666s`
- 평균 비용: `$0.005014 / run`

## 15. 병렬화 전/후 비교

| 항목 | 변경 전 | 변경 후 | 변화 |
| --- | ---: | ---: | ---: |
| 단건 평균 완료 시간 | 32.988s | 22.418s | -32.0% |
| 단건 최대 완료 시간 | 33.601s | 23.881s | -28.9% |
| 단건 평균 queue 대기 | 2.372s | 1.329s | -44.0% |
| 3건 burst 평균 완료 시간 | 62.488s | 44.115s | -29.4% |
| 3건 burst 최대 완료 시간 | 96.569s | 56.666s | -41.3% |
| 3건 burst 평균 queue 대기 | 22.331s | 12.780s | -42.8% |
| Artillery API 평균 응답 | 30.3ms | 43.3ms | +13.0ms |

해석:

- API ingress는 여전히 병목이 아니다. 응답 시간은 소폭 증가했지만 여전히 `43.3ms` 수준이다.
- 병렬화 후 핵심 개선은 `queue wait`와 `최대 완료 시간` 감소다.
- 단건 처리 시간도 같이 줄어들었고, 3건 burst 시 평균/최대 완료 시간이 모두 유의미하게 내려갔다.
- 비용은 run당 `~$0.0050` 수준으로 유지되어, 성능 개선이 비용 급증으로 이어지지는 않았다.

## 16. 후속 튜닝: `max-concurrent-runs` 3 vs 4

추가 튜닝 목적:

- `max-concurrent-runs = 2`에서는 3건 burst에서 세 번째 run(`223`)이 `35.821s` 대기했다.
- 그래서 운영 기본값 후보로 `3`, `4`를 같은 조건에서 다시 비교했다.

측정 환경:

- 프로필: `prod`
- 데이터셋: `5 cases`
- 모델: `OPENAI / gpt-4.1-mini`
- burst 간격: `1초`

### 3건 burst 비교

| 설정 | 평균 queue 대기 | 최대 queue 대기 | 평균 완료 시간 | 최대 완료 시간 |
| --- | ---: | ---: | ---: | ---: |
| `max-concurrent-runs = 2` | 12.780s | 35.821s | 44.115s | 56.666s |
| `max-concurrent-runs = 3` | 2.738s | 3.693s | 21.520s | 22.852s |
| `max-concurrent-runs = 4` | 2.329s | 3.286s | 22.053s | 23.489s |

### 5건 burst 비교

| 설정 | 평균 queue 대기 | 최대 queue 대기 | 평균 완료 시간 | 최대 완료 시간 |
| --- | ---: | ---: | ---: | ---: |
| `max-concurrent-runs = 3` | 8.178s | 17.360s | 23.532s | 32.126s |
| `max-concurrent-runs = 4` | 6.143s | 19.713s | 26.016s | 35.459s |

해석:

- `2 -> 3`은 분명한 개선이다. 3건 burst 기준 평균 완료 시간이 `44.115s -> 21.520s`로 절반 가까이 줄었다.
- `3 -> 4`는 시작 대기는 소폭 줄지만, 완료 시간은 오히려 약간 악화됐다.
- 5건 burst에서는 `4`가 평균 queue 대기만 줄였고, 평균/최대 완료 시간은 `3`보다 약 `10%` 나빴다.
- 원인은 현재 `case per run = 2`, `global active cases = 6`, `openai permits = 4` 상한이 먼저 걸리기 때문이다. run만 더 열면 completion 단계에서 경합이 늘어난다.

권장 기본값:

- `eval.worker.max-concurrent-runs = 3`
- `eval.execution.max-concurrent-cases-per-run = 2`
- `eval.execution.max-active-cases-global = 6`
- `eval.runner.provider-limits.openai-max-concurrent-calls = 4`

## 17. 남은 튜닝 포인트

- `max-concurrent-runs`는 `3`으로 올리는 것이 현재 설정 조합에서 가장 균형이 좋다.
- 다음 병목 후보는 `run 슬롯`보다 `global case limiter`와 `provider permit`이다.
- `max-concurrent-cases-per-run` 또는 provider permit 상향은 429 / 비용 / completion 분산을 같이 보면서 별도로 확인해야 한다.
- 동일 시나리오로 `10건` burst를 추가 측정하면 장기 적체 구간을 더 잘 볼 수 있다.

## 18. 최종 결론

- 병렬화 적용 후 Prompt Eval은 단건 기준 평균 완료 시간이 `32.988s -> 22.418s`로 줄었다.
- 후속 튜닝까지 포함하면 운영 기본값은 `max-concurrent-runs = 3`이 가장 적절하다.
- 3건 enqueue burst 기준 평균 완료 시간은 `44.115s -> 21.520s`, 최대 완료 시간은 `56.666s -> 22.852s`까지 추가 개선됐다.
- 현재 병목의 중심은 더 이상 HTTP ingress가 아니라 `global case limiter`, `provider concurrency`, 그리고 외부 LLM 호출 시간이다.
