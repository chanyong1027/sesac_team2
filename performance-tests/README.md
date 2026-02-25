# Performance Tests (Artillery)

Gateway, Auth, CRUD API의 기준선 성능을 측정하고 용량 한계를 식별하기 위한 Artillery 성능 테스트 모음입니다.

## 전제 조건

1. **Artillery CLI** 설치

```bash
npm install -g artillery
```

2. **환경 변수** 설정

```bash
cp .env.example .env
# .env 파일을 실제 테스트 환경에 맞게 수정
```

3. **테스트 데이터** 준비
   - 테스트용 사용자 계정이 존재해야 합니다 (`TEST_USER_EMAIL` / `TEST_USER_PASSWORD`)
   - 테스트 workspace에 유효한 API key가 발급되어 있어야 합니다 (`TEST_API_KEY`)
   - Gateway 시나리오용 프롬프트가 생성 및 릴리즈 되어 있어야 합니다 (`TEST_PROMPT_KEY`)

4. **앱 서버 접근** — `TARGET_URL`에 설정한 서버가 로컬에서 접근 가능해야 합니다 (보안 그룹 확인)

---

## 시나리오 목록

| # | 파일 | 목표 | 부하 패턴 |
|---|------|------|-----------|
| 01 | `01_auth_baseline.yml` | JWT 로그인 기준선 (P99 < 300ms) | 5→20 rps, 3분 |
| 02 | `02_gateway_chat_baseline.yml` | Gateway 오버헤드 측정 | 1→5→10 rps, 11분 |
| 03 | `03_gateway_chat_spike.yml` | 스레드풀 포화 테스트 | 1→20 rps 스파이크, 3.5분 |
| 04 | `04_crud_prompts.yml` | 관리 API CRUD 부하 | 10 rps, 3분 |
| 05 | `05_sustained_load.yml` | 30분 지속 부하 (메모리 누수 감지) | 2→8→2 rps, 35분 |
| 06 | `06_failover_budget.yml` | 예산 차단/Failover 검증 | 5 rps, 1분 (수동 병행) |

---

## 실행 방법

### 개별 시나리오 실행

```bash
# .env 로드 후 실행
set -a && source .env && set +a

# Auth 기준선
artillery run scenarios/01_auth_baseline.yml

# Gateway 기준선
artillery run scenarios/02_gateway_chat_baseline.yml

# JSON 리포트 생성
artillery run --output reports/01_auth_$(date +%Y%m%d_%H%M%S).json scenarios/01_auth_baseline.yml

# HTML 리포트 변환
artillery report reports/01_auth_20260224_120000.json
```

### Stub 모드로 실행 (전략 A)

Gateway 자체 오버헤드만 측정할 때 사용합니다.

```bash
# 1. Stub 프로필로 앱 시작
SPRING_PROFILES_ACTIVE=prod,test-perf ./gradlew bootRun

# 2. Gateway 시나리오 실행
artillery run scenarios/02_gateway_chat_baseline.yml
```

---

## LLM Stub 전략

### 전략 A: Stub ChatModel (test-perf 프로필)

- `PerfTestChatModelConfig`가 고정 200ms 지연 + 고정 응답을 반환
- Gateway 자체의 라우팅, 인증, 로깅, 예산 체크 오버헤드를 순수하게 측정
- `gateway_llm_call_seconds` 메트릭이 ~200ms로 안정적
- **용도**: Gateway 인프라 성능 기준선 확립

### 전략 B: 실제 LLM 호출

- 실제 OpenAI 등 provider를 사용하여 E2E 성능 측정
- LLM 응답 시간 변동성이 포함됨
- **용도**: 프로덕션에 가까운 실제 성능 프로파일링

---

## 성능 기준선 판단 기준

| 메트릭 | 정상 | 주의 | 위험 |
|--------|------|------|------|
| Gateway P50 | < 2s | 2~5s | > 5s |
| Gateway P99 | < 10s | 10~18s | > 18s (타임아웃 근접) |
| Auth P50 | < 200ms | 200~500ms | > 500ms |
| Auth P99 | < 300ms | 300~800ms | > 800ms |
| CRUD P99 | < 500ms | 500ms~1s | > 1s |
| Error Rate | < 1% | 1~5% | > 5% |
| HTTP 504 Rate | 0% | > 0% | > 1% |

---

## Grafana 관측 포인트

테스트 실행 중 Grafana 대시보드에서 아래 메트릭을 함께 관측하세요:

- **Gateway Overview**: `gateway_llm_call_seconds`, `gateway_chat_requests_total`
- **스레드풀**: `gateway_provider_call_threads_active` (03 스파이크 시 16에 도달하는지)
- **JVM**: Heap used 추세, GC pause time (05 지속 부하 시 우상향하면 누수 의심)
- **HikariCP**: active connections, pending requests (04 CRUD 시 풀 경합 확인)
- **Budget**: `gateway_budget_blocked_total` (06 시나리오)

---

## 06 Budget/Failover 수동 테스트 절차

1. **provider credential**의 `monthLimitUsd`를 매우 낮은 값으로 설정 (예: $0.01)
   - workspace의 `softLimitUsd`는 DEGRADE(모델 다운그레이드)만 발생하며 BLOCK이 아님
2. `artillery run scenarios/06_failover_budget.yml` 실행
3. 반복 호출로 예산 소진 → HTTP 429 응답 확인 (`BUDGET_EXCEEDED = TOO_MANY_REQUESTS`)
4. Grafana에서 `gateway_budget_blocked_total` 카운터 증가 확인
5. (Failover 테스트) Primary provider의 API key를 무효화
6. 시나리오 재실행 → `isFailover=true` 응답 확인
7. Grafana에서 `gateway_failover_total` 카운터 확인

---

## 디렉토리 구조

```text
performance-tests/
├── artillery.yml              # 공통 config (target, env vars, plugins)
├── scenarios/
│   ├── 01_auth_baseline.yml
│   ├── 02_gateway_chat_baseline.yml
│   ├── 03_gateway_chat_spike.yml
│   ├── 04_crud_prompts.yml
│   ├── 05_sustained_load.yml
│   └── 06_failover_budget.yml
├── data/
│   └── test-variables.csv
├── reports/
│   └── .gitkeep
├── .env.example
└── README.md
```
