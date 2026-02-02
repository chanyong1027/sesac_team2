package com.llm_ops.demo.prompt.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record PromptRollbackRequest(
    @NotNull(message = "롤백할 버전 ID는 필수입니다.")
    Long versionId,

    @Size(max = 500, message = "사유는 500자를 초과할 수 없습니다.")
    String reason
) {}
