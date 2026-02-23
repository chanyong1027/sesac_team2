const RULE_CHECK_LABELS: Record<string, string> = {
    must_include: '필수 키워드 포함',
    must_not_include: '금지 키워드 제외',
    max_chars: '글자 수 제한',
    max_lines: '줄 수 제한',
    json_parse: 'JSON 형식 파싱',
    schema: '필수 키/스키마 충족',
};

const JUDGE_LABELS: Record<string, string> = {
    MISSING_MUST_COVER: '핵심 항목 누락',
    RUBRIC_CRITERION_DEFINITION_MISSING: '평가 기준 정의 누락',
    JUDGE_ATTEMPT_NOT_CREATED: '자동 심사 실행 실패',
    JUDGE_JSON_NOT_FOUND: '심사 결과 형식 오류(JSON 미검출)',
    JUDGE_JSON_PARSE_FAIL: '심사 결과 파싱 실패',
};

const ERROR_CODE_LABELS: Record<string, string> = {
    EVAL_CASE_EXECUTION_ERROR: '평가 실행 중 내부 오류',
};

const DECISION_REASON_LABELS: Record<string, string> = {
    PASS_RATE_BELOW_THRESHOLD: '통과율이 기준보다 낮음',
    AVG_SCORE_BELOW_THRESHOLD: '평균 점수가 기준보다 낮음',
    ERROR_RATE_ABOVE_THRESHOLD: '오류율이 기준보다 높음',
    COMPARE_REGRESSION_DETECTED: '운영 버전 대비 성능/품질 저하',
    COMPARE_IMPROVEMENT_MINOR: '운영 대비 개선 폭이 작음',
    COMPARE_BASELINE_INCOMPLETE: '운영 비교 데이터가 충분하지 않음',
};

const RUN_STATUS_LABELS: Record<string, string> = {
    QUEUED: '대기',
    RUNNING: '실행 중',
    COMPLETED: '완료',
    FAILED: '실패',
    CANCELLED: '취소됨',
};

const CASE_STATUS_LABELS: Record<string, string> = {
    QUEUED: '대기',
    RUNNING: '실행 중',
    OK: '완료',
    ERROR: '오류',
    SKIPPED: '스킵',
};

const RISK_LEVEL_LABELS: Record<string, string> = {
    LOW: '낮음',
    MEDIUM: '중간',
    HIGH: '높음',
};

export function toKoreanRuleCheckLabel(key: string): string {
    return RULE_CHECK_LABELS[key] ?? key;
}

export function toKoreanJudgeLabel(label: string): string {
    return JUDGE_LABELS[label] ?? label;
}

export function toKoreanErrorCodeLabel(code: string): string {
    return ERROR_CODE_LABELS[code] ?? code;
}

export function toKoreanIssueText(issue: string): string {
    const value = issue.trim();
    if (!value) {
        return value;
    }

    if (DECISION_REASON_LABELS[value]) {
        return DECISION_REASON_LABELS[value];
    }

    const rulePrefix = '형식 검사 주요 실패: ';
    if (value.startsWith(rulePrefix)) {
        const raw = value.slice(rulePrefix.length).trim();
        return `${rulePrefix}${toKoreanRuleCheckLabel(raw)}`;
    }

    const judgePrefix = 'AI 심사 주요 이슈: ';
    if (value.startsWith(judgePrefix)) {
        const raw = value.slice(judgePrefix.length).trim();
        return `${judgePrefix}${toKoreanJudgeLabel(raw)}`;
    }

    const errorPrefix = '실행 오류 코드: ';
    if (value.startsWith(errorPrefix)) {
        const raw = value.slice(errorPrefix.length).trim();
        return `${errorPrefix}${toKoreanErrorCodeLabel(raw)}`;
    }

    return value;
}

export function toKoreanRunStatus(status: string): string {
    return RUN_STATUS_LABELS[status] ?? status;
}

export function toKoreanCaseStatus(status: string): string {
    return CASE_STATUS_LABELS[status] ?? status;
}

export function toKoreanRiskLevel(level: string): string {
    return RISK_LEVEL_LABELS[level] ?? level;
}
