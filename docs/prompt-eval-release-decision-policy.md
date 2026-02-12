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

### 4.2 Compare 모드 추가 조건
- `avgScoreDelta < 0` 이면 HOLD (회귀)
- `avgScoreDelta >= 0` 이고 `avgScoreDelta < minImprovementNoticeDelta` 이면 HOLD 아님, 경고(reason)만 추가

### 4.3 결과 필드
- `releaseDecision`: `SAFE_TO_DEPLOY` | `HOLD`
- `riskLevel`: `LOW` | `MEDIUM` | `HIGH`
- `decisionReasons`: 코드 배열
- `decisionBasis`: `RUN_SNAPSHOT`
- `criteriaSnapshot`: 판정에 실제 사용된 기준값
- `topIssues`: 상위 이슈 요약 문자열 배열
- `plainSummary`: PM/비개발자용 1~2줄 요약 문장

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
- `estimateNotice`에 “예상치이며 실제 실행과 차이가 있을 수 있음”을 명시
- 용도: 실행 전 의사결정 보조 (정산/청구 기준 아님)

## 8. UI 표시 원칙
- 결과 탭 상단에 `Release Decision`을 우선 표시한다.
- `decisionBasis=RUN_SNAPSHOT` 문구를 함께 표시한다.
- `riskLevel`과 `decisionReasons`를 함께 노출한다.
- Compare 모드에서는 `avgScoreDelta`를 상승/하락/동점으로 강조한다.
- 케이스 리스트는 기본적으로 이슈 중심으로 보여주고, 위험도 우선 정렬 옵션을 제공한다.
- 비교 케이스 상세에서는 `이번 테스트 버전`과 `현재 운영 버전`을 색상/카드로 구분해 표시한다.
