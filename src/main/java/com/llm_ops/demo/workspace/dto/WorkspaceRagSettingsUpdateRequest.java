package com.llm_ops.demo.workspace.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record WorkspaceRagSettingsUpdateRequest(
    @NotNull @Min(1) @Max(10) Integer topK,
    @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double similarityThreshold,
    @NotNull @Min(1) @Max(10) Integer maxChunks,
    @NotNull @Min(500) @Max(8000) Integer maxContextChars
) {
}
