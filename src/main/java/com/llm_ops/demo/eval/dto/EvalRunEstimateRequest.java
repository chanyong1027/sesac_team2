package com.llm_ops.demo.eval.dto;

import com.llm_ops.demo.eval.domain.EvalMode;
import com.llm_ops.demo.eval.domain.RubricTemplateCode;
import jakarta.validation.constraints.NotNull;

public record EvalRunEstimateRequest(
        @NotNull Long promptVersionId,
        @NotNull Long datasetId,
        @NotNull EvalMode mode,
        @NotNull RubricTemplateCode rubricTemplateCode
) {
}
