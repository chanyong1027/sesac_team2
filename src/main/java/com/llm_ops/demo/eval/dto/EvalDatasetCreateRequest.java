package com.llm_ops.demo.eval.dto;

import jakarta.validation.constraints.NotBlank;

public record EvalDatasetCreateRequest(
        @NotBlank String name,
        String description
) {
}
