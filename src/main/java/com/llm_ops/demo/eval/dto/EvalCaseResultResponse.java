package com.llm_ops.demo.eval.dto;

import com.llm_ops.demo.eval.domain.EvalCaseResult;
import com.llm_ops.demo.eval.domain.EvalCaseStatus;
import java.time.LocalDateTime;
import java.util.Map;

public record EvalCaseResultResponse(
        Long id,
        Long evalRunId,
        Long testCaseId,
        EvalCaseStatus status,
        String candidateOutput,
        String baselineOutput,
        Map<String, Object> candidateMeta,
        Map<String, Object> baselineMeta,
        Map<String, Object> ruleChecks,
        Map<String, Object> judgeOutput,
        Double overallScore,
        Boolean pass,
        String errorCode,
        String errorMessage,
        LocalDateTime startedAt,
        LocalDateTime completedAt
) {
    public static EvalCaseResultResponse from(EvalCaseResult result) {
        return new EvalCaseResultResponse(
                result.getId(),
                result.getEvalRun().getId(),
                result.getTestCase().getId(),
                result.status(),
                result.getCandidateOutputText(),
                result.getBaselineOutputText(),
                result.getCandidateMetaJson(),
                result.getBaselineMetaJson(),
                result.getRuleChecksJson(),
                result.getJudgeOutputJson(),
                result.getOverallScore(),
                result.getPass(),
                result.getErrorCode(),
                result.getErrorMessage(),
                result.getStartedAt(),
                result.getCompletedAt()
        );
    }
}
