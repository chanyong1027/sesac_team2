package com.llm_ops.demo.eval.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.Map;

public record EvalTestCaseCreateRequest(
        String externalId,
        @NotBlank String input,
        Map<String, Object> contextJson,
        Map<String, Object> expectedJson,
        Map<String, Object> constraintsJson
) {
}
