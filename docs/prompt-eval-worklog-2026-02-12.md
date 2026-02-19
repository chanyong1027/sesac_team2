# Prompt Eval 작업 로그 (2026-02-12)

## 1. 목적
- 프롬프트 버전이 실제 입력 케이스에서 얼마나 안정적으로 동작하는지 정량/정성으로 평가한다.
- `룰 기반 검사` + `LLM Judge`를 결합해 pass/fail 근거를 남긴다.
- 사용자 화면에서 준비(데이터셋) → 실행(런) → 분석(결과) 흐름을 분리한다.

## 2. 이번 반영 범위

### 2.0 2026-02-13 v2 추가 반영 (배포판단/Estimate)
- 워크스페이스 공통 배포판단 기준 도입
  - API: `GET/PUT /api/v1/workspaces/{workspaceId}/eval/release-criteria`
  - 기준 항목: `minPassRate`, `minAvgOverallScore`, `maxErrorRate`, `minImprovementNoticeDelta`
- Run 종료 시 snapshot 판정 저장
  - `summary.releaseDecision` (`SAFE_TO_DEPLOY`/`HOLD`)
  - `summary.riskLevel` (`LOW`/`MEDIUM`/`HIGH`)
  - `summary.decisionReasons` (코드 배열)
  - `summary.decisionBasis` (`RUN_SNAPSHOT`)
  - `summary.criteriaSnapshot` (실행 시점 기준값)
  - compare 모드일 때 `summary.avgScoreDelta`
- 실행 전 예상치 API 추가
  - API: `POST /api/v1/workspaces/{workspaceId}/prompts/{promptId}/eval/runs:estimate`
  - 범위값(min~max) 제공: calls/tokens/cost/duration
  - `estimatedCostTier` 제공: `LOW`/`MEDIUM`/`HIGH`
  - `estimateNotice`: 예상치임을 명시
- 결과 집계 확장
  - `summary.ruleFailCounts`, `summary.errorCodeCounts`, `summary.labelCounts`
  - `summary.topIssues`, `summary.plainSummary` 추가

### 2.1 백엔드 (Eval 코어)
- 평가 도메인/저장소/마이그레이션 추가 (`V23__prompt_eval_core.sql` 기반)
- Eval API 구현
  - Dataset 생성/조회
  - TestCase bulk upload
  - Run 생성/취소/조회
  - Run Case 조회(페이징)
- Worker 기반 비동기 실행
  - `QUEUED -> RUNNING -> COMPLETED/FAILED` 상태 전이
- 케이스 처리 파이프라인 구현
  - Candidate 호출
  - Rule Checker
  - Judge 호출
  - `overallScore`/`pass` 계산 후 저장
- Prompt 버전 생성 시 Auto Eval enqueue 연동

### 2.2 평가 정책/루브릭
- 지원 모드
  - `CANDIDATE_ONLY`
  - `COMPARE_ACTIVE` (candidate + baseline을 모두 채점하고 점수 차이/승자를 함께 기록, run pass 집계는 candidate 기준)
- 루브릭 템플릿
  - `GENERAL_TEXT`, `SUMMARY`, `JSON_EXTRACTION`, `CLASSIFICATION`
  - `CUSTOM` 추가
- `CUSTOM`에서 override 지원
  - `description`
  - `weights`
  - `gates`

### 2.3 프론트 (Evaluate 화면)
- 단일 화면 과밀 문제를 줄이기 위해 3탭으로 분리
  - `데이터셋 관리`
  - `평가 실행`
  - `결과 분석`
- 결과 분석 고도화
  - Run 상태 배지/진행률 표시
  - 케이스 행 클릭 시 상세 패널 표시
    - 입력, 후보 응답, baseline 응답, rule/judge 결과, meta(tokens/latency/cost), 에러
- UX 개선
  - `alert()` 제거, 토스트로 성공/실패 피드백 통일
  - 폴링 최적화(실행 중일 때만 polling)

### 2.4 신뢰도 보강 (Judge 안정화)
- 중요 기준 게이트 추가
  - `gates.minCriterionScores` 지원
  - 예: `{"minCriterionScores":{"safety":4,"accuracy":3}}`
  - overallScore가 높아도 핵심 항목 최소 점수 미달이면 fail 처리
- Fail 케이스 재판정 추가
  - `eval.judge.rejudge-on-fail`, `eval.judge.max-attempts` 설정 추가
  - 1차 판정 실패 시 최대 N회까지 재판정
  - 최종 결정: 하나라도 pass면 pass, 전부 fail이면 최고 overallScore 시도 결과를 채택
  - judgeOutput에 `judgeAttempts`, `judgeDecisionStrategy` 저장

### 2.5 3차 UI 개선 (결과 분석 가독성 강화)
- 케이스 리스트를 `위험도 우선`으로 정렬할 수 있게 개선
  - 위험도 분류: `HIGH / MEDIUM / LOW`
  - 기본값: 이슈 케이스를 위쪽에 노출해 운영자가 먼저 봐야 할 케이스를 빠르게 확인
- 케이스 테이블에 `위험도` 컬럼 추가
  - 배지로 시각 구분(고위험/중위험/저위험)
- 비교 모드 표현 강화
  - 비교 컬럼을 `Δ 이번-운영`으로 명확화
  - 셀 내부에 `이번/운영` 점수와 `Δ`를 동시에 표시
- 케이스 상세 비교 카드 개선
  - `이번 테스트 버전` vs `현재 운영 버전`을 별도 카드로 분리 표시
  - 점수/pass를 나란히 보여 PM/비개발자도 비교 결과를 직관적으로 해석 가능
- 용어 설명 섹션 추가
  - `상태`, `Pass`, `비교(Δ)` 의미를 케이스 리스트 상단에서 바로 확인 가능

## 3. 동작 원리 요약
1. 사용자가 `PromptVersion + Dataset`으로 Eval Run 생성
2. Worker가 Run을 가져와 케이스를 순차 처리
3. 각 케이스에서 Candidate 응답 생성
4. Candidate 응답을 Rule Checker로 검사
5. Judge 모델이 rubric/expected/constraints/rule 결과를 입력으로 점수화
6. 최종 pass 계산
   - `rulePass && judgePass && gatePass`
7. Run 집계(pass rate, failed/error count) 저장

## 4. 이번 검증 테스트 (실제 시나리오)
- 실무형 학부모/학교 CS 프롬프트로 E2E 실행
  - `promptId=3`, `versionId=4`, `datasetId=2`, `runId=8`
- 결과
  - `status=COMPLETED`
  - `totalCases=8`
  - `passedCases=7`
  - `failedCases=1`
  - `errorCases=0`
  - `passRate=87.5`
- 실패 1건 원인
  - `must_include` exact-match 조건 미충족
  - 예: `보충과제` vs `보충 과제` 표기 차이
  - 평가 시스템이 “실패 사유를 규칙 기반으로 분리”하는지 확인됨

## 5. 확인된 장점과 한계

### 장점
- 실행/저장/조회 전체 흐름이 엔드투엔드로 동작함
- 룰 실패와 Judge 판단 근거를 케이스 단위로 추적 가능
- UI에서 운영자가 원인 분석까지 바로 수행 가능

### 한계
- must_include/must_not_include가 문자열 exact-match 중심이라 오탐 가능
- 대량 케이스 실행 시 비용/시간 증가 (candidate + judge 2회 호출 구조)
- 결과 탭 URL 상태 공유(`tab/runId`)는 아직 미구현

## 6. 다음 작업 제안
1. Rule 정규화 옵션 추가 (공백/구두점 normalize)
2. 결과 화면 URL 상태 유지 (`?tab=...&runId=...`)
3. CI 자동 회귀 평가 게이트 (신규 버전/PR 생성 시 auto-run)

## 6-1. v2 정책 확정 사항 (리스크 반영)
1. Run 상세의 배포판단은 항상 **실행 당시 snapshot 기준**으로만 표시한다.
2. Compare 판정에서 절대 개선폭 임계치로 차단하지 않는다.
3. Compare 차단 조건은 `avgScoreDelta < 0`(회귀)만 사용한다.
4. `avgScoreDelta >= 0`이면서 개선폭이 작으면 `decisionReasons`에 경고만 남긴다.
5. Estimate는 공식 기반 범위값으로 제공하고, 실제값과 차이 가능성을 UI/응답에서 명시한다.

## 7. 상세 로직/동작 원리 (구현 기준)

### 7.1 실행 흐름 (Run 단위)
1. 사용자가 `promptVersionId + datasetId + mode + rubric`로 Run 생성
2. Run 생성 시 케이스 수만큼 `eval_case_results`를 `QUEUED`로 생성
3. Worker가 주기적으로 `QUEUED` Run을 가져와 `RUNNING` 전환
4. 케이스를 순차 처리하며 `QUEUED -> RUNNING -> OK/ERROR` 업데이트
5. 전체 케이스 처리 후 Run을 `COMPLETED`(또는 예외 시 `FAILED`)로 마감

### 7.2 케이스 처리 흐름 (Case 단위)
1. Candidate 모델 호출로 `candidate_output` 생성
2. Rule Checker 실행
   - `max_chars`, `max_lines`, `must_include`, `must_not_include`, `json_parse`, `schema`
3. Judge 호출
   - 입력: rubric + input/context/expected/constraints + candidate_output + ruleChecks (+ baselineOutput)
   - 출력: `pass`, `scores`, `labels`, `evidence`, `suggestions`
4. 점수 계산
   - rubric weights 기반 `overallScore`(0~100) 계산
5. 최종 pass 계산
   - `finalPass = judgePass && rulePass && gatePass`
6. 케이스 결과 저장
   - `candidateOutput`, `ruleChecks`, `judgeOutput`, `overallScore`, `pass`, `errorCode/errorMessage`

### 7.3 모드별 차이
- `CANDIDATE_ONLY`: 후보 버전만 호출
- `COMPARE_ACTIVE`:
  - 후보 + 현재 active 버전 둘 다 호출
  - 후보/배포 각각 Rule + Judge 채점 수행
  - 결과에 `compare` 요약(`candidateOverallScore`, `baselineOverallScore`, `scoreDelta`, `winner`) 저장
  - run 집계(passRate)는 기존처럼 candidate 기준 유지

### 7.4 데이터 모델 역할
- `eval_runs`: 실행 단위 상태/요약(passRate, counts)/비용 집계
- `eval_case_results`: 케이스 단위 상세 결과(분석용 핵심 데이터)
- `eval_datasets`, `eval_test_cases`: 재사용 가능한 테스트 자산
- `prompt_eval_defaults`: prompt별 기본 평가 설정(auto run, default rubric/mode/dataset)

## 8. 나중에 공부할 포인트

1. 평가 설계
- Rule-based evaluation vs LLM-as-a-Judge 장단점
- Precision/Recall 관점에서 false positive/false negative 균형

2. 품질 안정화
- Judge 편차 줄이는 방법(temperature, output schema 강제, 재평가 전략)
- 케이스셋 품질 관리(데이터 누수/편향/난이도 밸런싱)

3. 시스템 설계
- 비동기 Worker 패턴, idempotency, 재시도 정책
- 상태전이 설계(`QUEUED/RUNNING/COMPLETED/FAILED/CANCELLED`)

4. 비용/성능
- 병렬 처리와 rate limit 제어
- 모델별 비용 추정과 예산 상한 관리

5. 프롬프트 엔지니어링
- 버전 비교 평가 설계(회귀 탐지 관점)
- constraints/expected 설계를 통한 실무형 품질 게이트 구성

## 9. 면접에서 물어볼 수 있는 포인트와 답변 키워드

### Q1. 왜 Rule + Judge를 같이 썼나요?
- 키워드: 상호 보완
- 답변 포인트:
  - Rule은 형식/금칙/필수 항목 검증에 강함(결정적)
  - Judge는 의미 품질(도움됨/명확성/완성도) 평가에 강함
  - 둘을 결합해 신뢰도와 실무 유용성을 동시에 확보

### Q2. pass 계산은 어떻게 했나요?
- 키워드: 다중 게이트
- 답변 포인트:
  - `judgePass && rulePass && gatePass`
  - 게이트(minOverallScore, requireJsonParsePass)로 품질 하한선 유지

### Q3. 실패 원인 추적은 어떻게 했나요?
- 키워드: case-level observability
- 답변 포인트:
  - 케이스별 `ruleChecks.failedChecks`, `judgeOutput.labels/evidence`, `errorCode` 저장
  - UI 상세 패널에서 입력/응답/근거를 즉시 확인 가능

### Q4. 운영에서 가장 큰 리스크는?
- 키워드: Judge 편차, exact-match 오탐, 비용 선형 증가
- 답변 포인트:
  - Rule 정규화와 Judge 안정화, 조건부 재평가로 완화 계획

### Q5. 아키텍처 결정 포인트는?
- 키워드: 비동기 실행, 상태 전이, 재현 가능한 결과 저장
- 답변 포인트:
  - 사용자 요청 latency와 분리하기 위해 Worker 기반 비동기 실행 채택
  - run/case 분리 모델로 진행률/재실행/분석 확장성 확보

## 10. 이력서에 쓸 수 있는 성과/개선 포인트

### 10.1 현재 기준으로 쓸 수 있는 내용
- 프롬프트 버전 평가 파이프라인 설계/구현
  - Dataset 기반 자동 실행(Worker), Rule + LLM Judge 하이브리드 판정
- 평가 결과 관측성 구축
  - 케이스 단위 근거(rule/judge/meta/error) 저장 및 UI 상세 분석 지원
- 사용자 경험 개선
  - Evaluate 화면을 3탭(데이터셋/실행/결과)으로 재구성, 실행 중 폴링 최적화

### 10.2 성능 개선 과제로 확장 시 이력서 임팩트가 큰 항목
1. 병렬 실행 + 동시성 제어
- 기대효과: 총 평가시간 단축
- 지표 예시: `P95 run duration -40%`

2. 조건부 Judge 전략
- 아이디어: Rule 실패 케이스는 Judge 축소/스킵 옵션
- 기대효과: 비용 절감
- 지표 예시: `eval cost -25%`

3. Rule 정규화/동의어 매칭
- 기대효과: 문자열 표기 차이에 따른 오탐 감소
- 지표 예시: `false fail rate -30%`

4. Auto Eval CI 게이트
- 아이디어: 버전 생성/PR 시 자동 실행 후 기준 미달 차단
- 기대효과: 회귀 사전 차단
- 지표 예시: `배포 후 품질 이슈 건수 감소`

5. 비교 리포트 자동화(vN vs vN-1)
- 기대효과: 모델/프롬프트 변경의 영향 빠른 판단
- 지표 예시: `분석 리드타임 -50%`

## 11. 실무 적용 시 체크리스트
- 기준셋(Dataset) 난이도/도메인 분포가 실제 트래픽과 유사한가?
- expected/constraints가 너무 빡빡하거나 느슨하지 않은가?
- pass 기준(minOverallScore)이 팀 품질 기준과 일치하는가?
- 비용 상한과 실행 시간 상한이 운영 정책과 맞는가?
- 결과 해석 시 “실행 오류(ERROR)”와 “품질 실패(pass=false)”를 분리해서 보고 있는가?
