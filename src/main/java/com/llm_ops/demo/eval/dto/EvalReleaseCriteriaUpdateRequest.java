package com.llm_ops.demo.eval.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

public record EvalReleaseCriteriaUpdateRequest(
        @NotNull @DecimalMin("0.0") @DecimalMax("100.0") Double minPassRate,
        @NotNull @DecimalMin("0.0") @DecimalMax("100.0") Double minAvgOverallScore,
        @NotNull @DecimalMin("0.0") @DecimalMax("100.0") Double maxErrorRate,
        @NotNull @DecimalMin("0.0") @DecimalMax("100.0") Double minImprovementNoticeDelta
) {
}
