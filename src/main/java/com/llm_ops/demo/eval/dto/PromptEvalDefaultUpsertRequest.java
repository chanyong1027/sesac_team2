package com.llm_ops.demo.eval.dto;

import com.llm_ops.demo.eval.domain.EvalMode;
import com.llm_ops.demo.eval.domain.RubricTemplateCode;
import jakarta.validation.constraints.NotNull;
import java.util.Map;

public record PromptEvalDefaultUpsertRequest(
        Long datasetId,
        @NotNull RubricTemplateCode rubricTemplateCode,
        Map<String, Object> rubricOverrides,
        @NotNull EvalMode defaultMode,
        @NotNull Boolean autoEvalEnabled
) {
}
