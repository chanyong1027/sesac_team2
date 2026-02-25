package com.llm_ops.demo.eval.dto;

import com.llm_ops.demo.eval.domain.EvalCaseResult;
import com.llm_ops.demo.eval.domain.EvalCaseStatus;
import com.llm_ops.demo.eval.domain.EvalHumanReviewVerdict;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
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
        LocalDateTime completedAt,
        EvalHumanReviewVerdict humanReviewVerdict,
        Boolean humanOverridePass,
        String humanReviewComment,
        String humanReviewCategory,
        Long humanReviewedBy,
        OffsetDateTime humanReviewedAt,
        Boolean effectivePass
) {
    public static EvalCaseResultResponse from(EvalCaseResult result) {
        return new EvalCaseResultResponse(
                result.getId(),
                result.getEvalRunId(),
                result.getTestCaseId(),
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
                result.getCompletedAt(),
                result.getHumanReviewVerdict(),
                result.getHumanOverridePass(),
                result.getHumanReviewComment(),
                result.getHumanReviewCategory(),
                result.getHumanReviewedBy(),
                result.getHumanReviewedAt(),
                result.effectivePass()
        );
    }
}
