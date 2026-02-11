# Gateway 장애대응/에러코드 표준화 작업 정리 (2026-02-10)

## 1) 작업 목적

- 게이트웨이 실패 원인을 표준 코드로 통일해서 운영 로그 분류를 쉽게 만들기
- 실패 유형별 retry/failover 동작을 일관되게 적용하기
- 사용자 응답에서도 `GW-*` 코드 확인이 가능하도록 정렬하기
- 민감 정보가 에러 메시지에 노출되지 않도록 최소 마스킹 적용하기

## 2) 오늘 반영한 핵심 변경

### A. 실패 분류/정책 로직

- `GatewayFailureClassifier` 기준으로 예외를 표준 코드 + 정책으로 분류
- 정책:
  - 즉시 Failover: `GW-UP-RATE_LIMIT`, `GW-UP-MODEL_NOT_FOUND`
  - 1회 Retry 후 Failover: `GW-UP-TIMEOUT`, `GW-UP-UNAVAILABLE`
  - Fail Fast: `GW-REQ-*`, `GW-GW-POLICY_BLOCKED`

### B. Gateway 서비스 예외 전파 방식 개선

- `GatewayChatService`에서 최종 실패 시 `GatewayException`으로 래핑해서 전파
- `cause`를 유지하도록 변경하여 장애 분석 시 스택 추적 가능
- all providers failed 케이스는 `GW-GW-ALL_PROVIDERS_FAILED`로 정규화 유지

### C. 사용자 응답/보안 처리

- `GlobalExceptionHandler`에 `GatewayException` 핸들러 추가
- `/v1/chat/**` 경로의 `BusinessException`을 `GW-*` 코드로 매핑해서 응답
- 메시지에 민감 키워드(`apiKey`, `token`, `authorization`, `secret`, `password`)가 포함될 경우 `[REDACTED]` 처리
- 메시지 길이 제한(최대 300자) 적용

### D. 테스트 보강/정렬

- 서비스 테스트에서 failover/최종실패 코드 검증 유지
- 컨트롤러 테스트에 `GW-REQ-UNAUTHORIZED` 응답 코드 검증 추가
- 기존 컴파일을 막던 `GatewayChatRequest` Javadoc 문법 오류(주석 줄 깨짐) 1건 수정

## 3) Spring AI 추상화 사용 방식 (현재 구조)

### A. 공통 호출 인터페이스

- 게이트웨이 서비스는 내부적으로 `ChatResponse`를 공통 결과 타입으로 사용
- OpenAI 호출은 Spring AI의 `ChatModel.call(Prompt)`를 사용
- Anthropic 호출도 Spring AI의 `AnthropicChatModel.call(Prompt)`를 사용
- Gemini는 `com.google.genai.Client`를 사용하지만, 결과를 `ChatResponse`로 변환해서 상위 로직은 동일하게 처리

### B. 현재 상태 요약

- 요청/응답 처리의 상위 흐름은 공통화됨 (`GatewayChatService`에서 provider별 분기 후 `ChatResponse` 수렴)
- 단, provider SDK 레벨은 완전 단일화는 아님
  - OpenAI/Anthropic: Spring AI
  - Gemini: Google SDK + 어댑팅

## 4) Failover 설계 기준과 실제 동작

### A. 분류 기준

- `GatewayFailureClassifier`는 예외가 발생하면 아래 3가지를 한 번에 정합니다.
1. `errorCode`
- "무슨 종류의 실패인지"를 보여주는 표준 코드
- 예: `GW-UP-RATE_LIMIT`, `GW-UP-TIMEOUT`

2. `failReason`
- "정확히 왜 실패했는지"를 보여주는 상세 원인
- 예: `HTTP_429`, `SOCKET_TIMEOUT`, `MODEL_404`

3. `policy`
- "다음에 시스템이 어떻게 동작할지"를 결정하는 실행 규칙

policy는 아래 3개 중 하나로 결정됩니다.

1. `IMMEDIATE_FAILOVER`
- 의미: 같은 경로 재시도 없이 바로 secondary로 전환
- 주로: rate limit, model not found 같은 구조적 실패

2. `RETRY_ONCE_THEN_FAILOVER`
- 의미: 같은 경로 1번만 재시도하고, 또 실패하면 secondary 전환
- 주로: timeout, 5xx, connection 같은 일시적 실패

3. `FAIL_FAST`
- 의미: 재시도/전환 없이 즉시 실패 반환
- 주로: 요청값 오류, 인증/권한 오류, 정책 차단

한 줄 요약:
- `errorCode` = 어떤 실패인가
- `failReason` = 왜 실패했는가
- `policy` = 그래서 다음에 무엇을 할 것인가

### B. 동작 규칙

1. 즉시 failover
- `GW-UP-RATE_LIMIT`
- `GW-UP-MODEL_NOT_FOUND`

2. 1회 retry 후 failover
- `GW-UP-TIMEOUT`
- `GW-UP-UNAVAILABLE`

3. fail-fast
- `GW-REQ-*`
- `GW-GW-POLICY_BLOCKED`

4. 최종 실패
- primary/secondary 모두 실패 시 `GW-GW-ALL_PROVIDERS_FAILED`로 정규화
- 최종 예외는 `GatewayException`으로 전파되며 `cause` 포함

### C. 전역 시간예산(20초) 기반 동작 추가

1. `gateway.reliability.request-timeout-ms=20000` 기준으로 요청별 deadline을 계산한다.
2. provider 호출은 남은 시간 기반으로 수행되며, 각 단계 전 남은 시간을 체크한다.
3. `RETRY_ONCE_THEN_FAILOVER` 대상이라도 남은 시간이 `min-retry-budget-ms`보다 작으면 retry를 생략한다.
4. failover 직전 남은 시간이 `min-failover-budget-ms`보다 작으면 `GW-UP-TIMEOUT`(fail_reason=`REQUEST_DEADLINE_EXCEEDED`)로 종료한다.
5. 요청 시간예산 초과는 `error_code/fail_reason`로 로그에 남아 운영에서 즉시 식별할 수 있다.

## 5) 오류 코드 목록과 의미

| 코드 | 의미 | 운영 해석 |
| --- | --- | --- |
| `GW-REQ-INVALID_REQUEST` | 요청값/형식 오류 | 요청 페이로드 수정 필요 |
| `GW-REQ-UNAUTHORIZED` | 인증 실패 | API 키/인증 헤더 점검 |
| `GW-REQ-FORBIDDEN` | 권한/접근 불가 | 조직/워크스페이스 권한 점검 |
| `GW-REQ-QUOTA_EXCEEDED` | 고객/정책 기준 쿼터 초과 | 예산/한도 설정 확인 |
| `GW-UP-RATE_LIMIT` | 업스트림 429/리소스 제한 | 트래픽/쿼터, fallback 상태 확인 |
| `GW-UP-TIMEOUT` | 업스트림 타임아웃 | 네트워크/업스트림 지연 점검 |
| `GW-UP-UNAVAILABLE` | 업스트림 연결/5xx 불가용 | 업스트림 상태 점검 |
| `GW-UP-MODEL_NOT_FOUND` | 요청 모델 미존재 | 모델 라우팅/모델명 점검 |
| `GW-GW-POLICY_BLOCKED` | 게이트웨이 내부 정책 차단 | 내부 정책/가드레일 점검 |
| `GW-GW-ALL_PROVIDERS_FAILED` | 모든 경로 실패 | 장애 우선 대응 필요 |

보조 필드(`fail_reason`) 예시:
- `HTTP_429`, `HTTP_503`, `SOCKET_TIMEOUT`, `MODEL_404`, `RESOURCE_EXHAUSTED`, `PROVIDER_BUDGET_EXCEEDED`

## 6) 현재 게이트웨이에서 적재하는 로그 항목

### A. 시작 시점 (`start`)

- 식별: `request_id`, `trace_id`
- 호출 컨텍스트: `organization_id`, `workspace_id`, `api_key_id`, `api_key_prefix`
- 요청 메타: `request_path`, `http_method`, `prompt_key`, `rag_enabled`
- 상태: `status=IN_PROGRESS`, `currency=USD`, `created_at`

### B. 성공 시점 (`markSuccess`)

- 상태/시간: `status=SUCCESS`, `http_status`, `finished_at`, `latency_ms`
- 모델/라우팅: `provider`, `requested_model`, `used_model`, `is_failover`
- 사용량/비용: `input_tokens`, `output_tokens`, `total_tokens`, `estimated_cost`, `pricing_version`
- RAG 메트릭: `rag_latency_ms`, `rag_chunks_count`, `rag_context_chars`, `rag_context_truncated`, `rag_context_hash`, `rag_top_k`, `rag_similarity_threshold`

### C. 실패/차단 시점 (`markFail` / `markBlocked`)

- 상태/시간: `status=FAIL|BLOCKED`, `http_status`, `finished_at`, `latency_ms`
- 에러 핵심 3종:
  - `error_code`: 표준 코드 (`GW-*`)
  - `fail_reason`: 상세 원인
  - `error_message`: 사용자 안내 문구(마스킹 적용 대상)
- 필요 시 모델/토큰/RAG 필드도 함께 기록

## 7) 주요 변경 파일

- `/Users/jiwoo/IdeaProjects/sesac_team2/src/main/java/com/llm_ops/demo/gateway/service/GatewayChatService.java`
- `/Users/jiwoo/IdeaProjects/sesac_team2/src/main/java/com/llm_ops/demo/gateway/service/GatewayFailureClassifier.java`
- `/Users/jiwoo/IdeaProjects/sesac_team2/src/main/java/com/llm_ops/demo/global/error/GatewayException.java` (신규)
- `/Users/jiwoo/IdeaProjects/sesac_team2/src/main/java/com/llm_ops/demo/global/error/ErrorResponse.java`
- `/Users/jiwoo/IdeaProjects/sesac_team2/src/main/java/com/llm_ops/demo/global/handler/GlobalExceptionHandler.java`
- `/Users/jiwoo/IdeaProjects/sesac_team2/src/main/java/com/llm_ops/demo/gateway/dto/GatewayChatRequest.java` (Javadoc 컴파일 오류 수정)
- `/Users/jiwoo/IdeaProjects/sesac_team2/src/test/java/com/llm_ops/demo/gateway/service/GatewayChatServiceUnitTest.java`
- `/Users/jiwoo/IdeaProjects/sesac_team2/src/test/java/com/llm_ops/demo/gateway/service/GatewayChatServiceTest.java`
- `/Users/jiwoo/IdeaProjects/sesac_team2/src/test/java/com/llm_ops/demo/gateway/GatewayChatControllerTest.java`

## 8) 검증 결과

실행 명령:

```bash
./gradlew test \
  --tests 'com.llm_ops.demo.gateway.service.GatewayChatServiceUnitTest' \
  --tests 'com.llm_ops.demo.gateway.service.GatewayChatServiceTest' \
  --tests 'com.llm_ops.demo.gateway.GatewayChatControllerTest'
```

결과:

- 성공 (BUILD SUCCESSFUL)
- Spring AI metadata builder deprecation warning만 존재 (기능 영향 없음)

## 9) 팀 공유용 요약 (복붙)

```text
[Gateway 장애대응/에러코드 표준화 반영 공유]

1) Gateway 실패를 표준 코드(GW-*)로 분류/로그 저장하도록 정리했습니다.
2) Failover 정책을 코드로 고정했습니다.
   - 즉시 failover: RATE_LIMIT, MODEL_NOT_FOUND
   - 1회 retry 후 failover: TIMEOUT, UNAVAILABLE
   - fail fast: REQ/POLICY 계열
3) 사용자 응답도 gateway 에러 시 GW-* 코드를 받도록 정렬했습니다.
4) 에러 메시지에 민감정보가 섞일 수 있어 간단 마스킹([REDACTED]) 적용했습니다.
5) 관련 단위/통합(서비스+컨트롤러) 테스트 통과 확인했습니다.
```

## 10) 후속 권장 작업

1. `MODEL_NOT_FOUND` 직접 시나리오 테스트 추가(현재는 정책 분기와 all-failed 중심 검증)
2. 에러 메시지 마스킹 규칙을 공용 유틸로 분리해 재사용 검토
3. Gateway 에러 응답 스키마(`retryable`, `action`)는 이번 범위 밖이므로 다음 단계에서 확장 여부 결정

## 11) 내부 동작 원리 (로직 플로우 Deep Dive)

### A. 요청 1건 처리 순서

1. 인증 및 기본 컨텍스트 획득
- `X-API-Key` 기반으로 조직/키 정보 조회

2. 로그 시작
- `request_logs`에 `IN_PROGRESS`로 동기 INSERT (`traceId`, 조직/워크스페이스, 경로, RAG 여부)

3. 프롬프트/워크스페이스 해석
- 활성 워크스페이스 조회
- prompt key로 active version 조회
- 변수 치환으로 user/system prompt 렌더링

4. 예산 정책 반영
- workspace degrade 정책 평가(모델 다운그레이드, max tokens override, RAG off)
- primary provider credential 예산 블록 여부 평가

5. RAG(선택)
- `ragEnabled` + runtime settings 기준으로 검색
- 문맥 병합 후 프롬프트 앞단에 컨텍스트 주입
- rag latency/chunk/hash 메트릭 계산

6. LLM 호출 (primary -> secondary)
- `callProviderWithPolicy`로 primary 호출
- 실패 시 `GatewayFailureClassifier`로 정책 판정
  - immediate failover / retry once then failover / fail-fast
- 필요 시 secondary 경로로 전환
- secondary도 실패하면 `GW-GW-ALL_PROVIDERS_FAILED`로 정규화

7. 사용량/비용 계산
- ChatResponse metadata에서 토큰 추출
- 모델 단가 기반 비용 계산
- workspace + provider credential 예산 사용량 동기 집계

8. 로그 종료 및 응답
- 성공: `markSuccess`
- 실패/차단: `markFail` 또는 `markBlocked` + `error_code/fail_reason/error_message`
- 예외는 `GatewayException`으로 래핑해 `GW-*` 코드로 사용자에게 반환

### B. 왜 이렇게 설계했는가

- 상위 비즈니스 로직은 provider SDK 차이를 몰라도 되도록 `ChatResponse` 중심으로 수렴
- 예산/정책/실패 분류를 호출 전후에 분리해 운영 원인 분석을 단순화
- 로그 스키마는 유지하면서(`request_logs` 컬럼 재사용) 운영 가시성만 향상

## 12) 주요 클래스 역할 정리

| 클래스 | 역할 | 핵심 포인트 |
| --- | --- | --- |
| `GatewayChatService` | 게이트웨이 오케스트레이션 | 인증, 프롬프트, RAG, 예산, provider 호출, failover, 로깅까지 총괄 |
| `GatewayFailureClassifier` | 실패 분류기 | 예외 -> 표준 코드/상세 원인/정책 매핑 |
| `RequestLogWriter` | 로그 writer | start(동기), markSuccess/Fail/Blocked(비동기) |
| `GlobalExceptionHandler` | 공통 예외 응답 | gateway 경로는 `GW-*` 코드로 응답 + 메시지 마스킹 |
| `BudgetGuardrailService` | 예산 정책 엔진 | block/degrade 의사결정 |
| `RagSearchService` / `RagContextBuilder` | RAG 처리 | 검색/문맥 구성/메트릭 산출 |

## 13) 사용 라이브러리/프레임워크 (면접/학습용)

### A. 백엔드 코어

1. Spring Boot (Web, Validation, Security, Actuator)
- REST API, 검증, 보안 체계, 운영 엔드포인트 구성

2. Spring Data JPA + Hibernate
- 로그/도메인 엔티티 영속화

3. Flyway
- DB 마이그레이션 관리

### B. AI/LLM 관련

1. Spring AI
- OpenAI/Anthropic 호출을 `ChatModel` 계층으로 추상화
- `Prompt`, `ChatResponse` 중심으로 공통 처리 가능

2. Google GenAI SDK (`com.google.genai`)
- Gemini 호출
- 현재는 SDK 호출 결과를 `ChatResponse`로 어댑팅해 상위 로직 통일

### C. RAG/검색 관련

1. Spring AI PgVector Store
- 벡터 저장소 연동

2. Spring AI Tika Document Reader
- 문서 텍스트 추출 파이프라인 구성

### D. 운영/품질 관련

1. Lombok
- 보일러플레이트 감소 (`@Getter`, `@RequiredArgsConstructor` 등)

2. JUnit 5 + Mockito + Spring Test
- 단위/통합 테스트
- failover 시나리오 재현, 로그 적재 검증

## 14) 면접에서 설명하기 좋은 포인트

1. “멀티 프로바이더 호출을 어떤 기준으로 failover 했는가?”
- 장애 원인을 예외 타입/HTTP status로 분류하고, 원인별 정책을 분리했다.

2. “왜 로그 스키마를 안 늘렸는가?”
- 운영 영향 최소화를 위해 기존 컬럼(`error_code`, `fail_reason`, `error_message`) 재활용했다.

3. “신뢰성과 응답시간을 어떻게 균형 맞췄는가?”
- 구조적 실패는 즉시 failover, 일시적 실패는 1회 retry 후 전환으로 지연을 제한했다.

4. “보안은 어떻게 챙겼는가?”
- gateway 에러 응답 경로에서 메시지 마스킹을 적용해 민감 문자열 노출을 완화했다.
