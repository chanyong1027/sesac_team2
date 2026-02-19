package com.llm_ops.demo.eval.dto;

import com.llm_ops.demo.eval.domain.EvalMode;
import com.llm_ops.demo.eval.domain.PromptEvalDefault;
import com.llm_ops.demo.eval.domain.RubricTemplateCode;
import java.time.LocalDateTime;
import java.util.Map;

public record PromptEvalDefaultResponse(
        Long promptId,
        Long datasetId,
        RubricTemplateCode rubricTemplateCode,
        Map<String, Object> rubricOverrides,
        EvalMode defaultMode,
        boolean autoEvalEnabled,
        Long updatedBy,
        LocalDateTime updatedAt
) {
    public static PromptEvalDefaultResponse from(PromptEvalDefault value) {
        return new PromptEvalDefaultResponse(
                value.getPrompt().getId(),
                value.getDataset() != null ? value.getDataset().getId() : null,
                value.rubricTemplateCode(),
                value.getRubricOverridesJson(),
                value.defaultMode(),
                value.isAutoEvalEnabled(),
                value.getUpdatedBy(),
                value.getUpdatedAt()
        );
    }
}
