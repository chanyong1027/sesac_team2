package com.llm_ops.demo.workspace.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record WorkspaceUpdateRequest(
    @NotBlank(message = "워크스페이스 이름은 필수입니다.")
    @Size(max = 100, message = "워크스페이스 이름은 100자를 초과할 수 없습니다.")
    String displayName
) {}
