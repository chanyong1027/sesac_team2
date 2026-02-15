package com.llm_ops.demo.eval.dto;

import com.llm_ops.demo.eval.domain.EvalTestCase;
import java.time.LocalDateTime;
import java.util.Map;

public record EvalTestCaseResponse(
        Long id,
        Long datasetId,
        Integer caseOrder,
        String externalId,
        String input,
        Map<String, Object> contextJson,
        Map<String, Object> expectedJson,
        Map<String, Object> constraintsJson,
        boolean enabled,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static EvalTestCaseResponse from(EvalTestCase testCase) {
        return new EvalTestCaseResponse(
                testCase.getId(),
                testCase.getDataset().getId(),
                testCase.getCaseOrder(),
                testCase.getExternalId(),
                testCase.getInputText(),
                testCase.getContextJson(),
                testCase.getExpectedJson(),
                testCase.getConstraintsJson(),
                testCase.isEnabled(),
                testCase.getCreatedAt(),
                testCase.getUpdatedAt()
        );
    }
}
