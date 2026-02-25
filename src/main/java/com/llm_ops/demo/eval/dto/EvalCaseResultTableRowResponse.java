package com.llm_ops.demo.eval.dto;

import com.llm_ops.demo.eval.domain.EvalCaseStatus;
import com.llm_ops.demo.eval.domain.EvalHumanReviewVerdict;
import java.time.LocalDateTime;
import java.util.List;

public record EvalCaseResultTableRowResponse(
        Long id,
        Long testCaseId,
        EvalCaseStatus status,
        Double overallScore,
        Boolean pass,
        Boolean effectivePass,
        EvalHumanReviewVerdict humanReviewVerdict,
        List<String> labels,
        String reason,
        LocalDateTime startedAt,
        LocalDateTime completedAt
) {
}
