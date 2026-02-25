package com.llm_ops.demo.eval.dto;

import com.llm_ops.demo.eval.domain.EvalMode;
import com.llm_ops.demo.eval.domain.PromptEvalDefaultDraft;
import com.llm_ops.demo.eval.domain.RubricTemplateCode;
import java.time.LocalDateTime;
import java.util.Map;

public record PromptEvalDefaultDraftResponse(
        Long promptId,
        Long datasetId,
        RubricTemplateCode rubricTemplateCode,
        Map<String, Object> rubricOverrides,
        Map<String, Object> criteriaAnchors,
        EvalMode defaultMode,
        Boolean autoEvalEnabled,
        Map<String, Boolean> completedSections,
        Long updatedBy,
        LocalDateTime updatedAt,
        LocalDateTime createdAt
) {
    public static PromptEvalDefaultDraftResponse from(PromptEvalDefaultDraft value) {
        return new PromptEvalDefaultDraftResponse(
                value.getPrompt().getId(),
                value.getDatasetId(),
                value.rubricTemplateCode(),
                value.getRubricOverridesJson(),
                value.getCriteriaAnchorsJson(),
                value.defaultMode(),
                value.getAutoEvalEnabled(),
                value.getCompletedSectionsJson(),
                value.getUpdatedBy(),
                value.getUpdatedAt(),
                value.getCreatedAt()
        );
    }
}
