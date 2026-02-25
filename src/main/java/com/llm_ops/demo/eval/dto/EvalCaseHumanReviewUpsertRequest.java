package com.llm_ops.demo.eval.dto;

import com.llm_ops.demo.eval.domain.EvalHumanReviewVerdict;
import jakarta.validation.constraints.NotNull;

public record EvalCaseHumanReviewUpsertRequest(
        @NotNull EvalHumanReviewVerdict verdict,
        Boolean overridePass,
        String comment,
        String category,
        String requestId
) {
}
