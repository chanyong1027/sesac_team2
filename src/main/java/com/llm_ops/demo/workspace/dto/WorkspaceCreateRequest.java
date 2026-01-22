package com.llm_ops.demo.workspace.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record WorkspaceCreateRequest(
    @NotBlank(message = "워크스페이스 식별자는 필수입니다.")
    @Size(max = 50, message = "워크스페이스 식별자는 50자를 초과할 수 없습니다.")
    @Pattern(regexp = "^[a-z0-9-]+$", message = "식별자는 소문자, 숫자, 하이픈만 사용 가능합니다.")
    String name,

    @NotBlank(message = "워크스페이스 이름은 필수입니다.")
    @Size(max = 100, message = "워크스페이스 이름은 100자를 초과할 수 없습니다.")
    String displayName
) {}
