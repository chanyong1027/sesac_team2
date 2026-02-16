# Prompt Eval Release Decision Policy (v2)

## 1. 목적
- Evaluate 결과를 점수 나열이 아니라 배포 의사결정으로 해석하기 위한 공통 기준을 정의한다.
- 과거 Run 재조회 시 판정이 변하지 않도록 실행 시점 기준(snapshot) 판정 원칙을 고정한다.

## 2. 적용 범위
- 대상: `/api/v1/workspaces/{workspaceId}/prompts/{promptId}/eval/runs`
- 모드: `CANDIDATE_ONLY`, `COMPARE_ACTIVE`
- 저장 위치: `eval_runs.summary_json`

## 3. 기준 설정 (워크스페이스 공통)
- API
  - `GET /api/v1/workspaces/{workspaceId}/eval/release-criteria`
  - `PUT /api/v1/workspaces/{workspaceId}/eval/release-criteria`
- 필드
  - `minPassRate` (0~100)
  - `minAvgOverallScore` (0~100)
  - `maxErrorRate` (0~100)
  - `minImprovementNoticeDelta` (0~100, 경고 기준)

## 4. 판정 규칙

### 4.1 공통 HOLD 조건
- `passRate < minPassRate`
- `avgOverallScore < minAvgOverallScore`
- `errorRate > maxErrorRate`

### 4.2 CANDIDATE_ONLY 모드
- 4.1 공통 HOLD 조건만 적용한다.
- `avgScoreDelta` 기반 비교 조건은 평가하지 않는다.

### 4.3 Compare 모드 추가 조건
- `avgScoreDelta < 0` 이면 HOLD (회귀)
- `avgScoreDelta >= 0` 이고 `avgScoreDelta < minImprovementNoticeDelta` 이면 HOLD 아님, 경고(reason)만 추가

### 4.4 riskLevel 산출 규칙
- `HIGH`
  - `decisionReasons`에 `COMPARE_REGRESSION_DETECTED` 또는 `ERROR_RATE_ABOVE_THRESHOLD`가 포함된 경우
- `MEDIUM`
  - blocking reason이 존재하지만 `HIGH` 조건이 아닌 경우
  - 또는 blocking reason은 없지만 warning reason(`COMPARE_IMPROVEMENT_MINOR`)만 존재하는 경우
- `LOW`
  - blocking/warning reason이 모두 없는 경우

### 4.5 결과 필드
- `releaseDecision`: `SAFE_TO_DEPLOY` | `HOLD`
- `riskLevel`: `LOW` | `MEDIUM` | `HIGH`
- `decisionReasons`: 코드 배열
- `decisionBasis`: `RUN_SNAPSHOT`
- `criteriaSnapshot`: 판정에 실제 사용된 기준값
- `topIssues`: 최대 5개 이슈 요약 배열
  - 우선순위: `decisionReasons` 라벨 → `ruleFailCounts` 최다 항목 → `errorCodeCounts` 최다 항목 → `labelCounts` 최다 항목
- `plainSummary`: 아래 요소를 `/`로 연결한 단문 요약
  - `판정`, `PassRate`, `평균점수`, (Compare 모드인 경우) `비교Δ`, (있는 경우) `topIssues[0]`

## 5. snapshot 원칙
- Run 완료 시점에 `releaseDecision/riskLevel/reasons/criteriaSnapshot`을 저장한다.
- Run 조회 시 재계산하지 않는다.
- 기준값 변경 이후에도 과거 Run 결과는 변하지 않는다.

## 6. reason 코드 표준
- `PASS_RATE_BELOW_THRESHOLD`
- `AVG_SCORE_BELOW_THRESHOLD`
- `ERROR_RATE_ABOVE_THRESHOLD`
- `COMPARE_REGRESSION_DETECTED`
- `COMPARE_IMPROVEMENT_MINOR` (경고)

## 7. Estimate 정책
- API: `POST /api/v1/workspaces/{workspaceId}/prompts/{promptId}/eval/runs:estimate`
- 단일값이 아닌 범위값(`min~max`)으로 제공
  - `estimatedCallsMin/Max`
  - `estimatedTokensMin/Max`
  - `estimatedCostUsdMin/Max`
  - `estimatedCostTier` (`LOW`/`MEDIUM`/`HIGH`)
  - `estimatedDurationSecMin/Max`
- `estimatedCostTier` 분류 기준(`estimatedCostUsdMax` 기준)
  - `LOW`: `< 0.05 USD`
  - `MEDIUM`: `>= 0.05 USD` and `< 0.20 USD`
  - `HIGH`: `>= 0.20 USD`
- `estimateNotice`에 “예상치이며 실제 실행과 차이가 있을 수 있음”을 명시
- 용도: 실행 전 의사결정 보조 (정산/청구 기준 아님)

## 8. UI 표시 원칙
- 결과 탭 상단에 `Release Decision`을 우선 표시한다.
- `decisionBasis=RUN_SNAPSHOT` 문구를 함께 표시한다.
- `riskLevel`과 `decisionReasons`를 함께 노출한다.
- Compare 모드에서는 `avgScoreDelta`를 상승/하락/동점으로 강조한다.
- 케이스 리스트는 기본적으로 이슈 중심으로 보여주고, 위험도 우선 정렬 옵션을 제공한다.
- 비교 케이스 상세에서는 `이번 테스트 버전`과 `현재 운영 버전`을 색상/카드로 구분해 표시한다.
