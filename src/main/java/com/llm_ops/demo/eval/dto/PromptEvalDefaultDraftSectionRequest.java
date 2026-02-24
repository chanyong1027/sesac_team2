package com.llm_ops.demo.eval.dto;

import com.llm_ops.demo.eval.domain.EvalMode;
import com.llm_ops.demo.eval.domain.RubricTemplateCode;
import java.util.Map;

public record PromptEvalDefaultDraftSectionRequest(
        Long datasetId,
        RubricTemplateCode rubricTemplateCode,
        Map<String, Object> rubricOverrides,
        Map<String, Object> criteriaAnchors,
        EvalMode defaultMode,
        Boolean autoEvalEnabled
) {
}
