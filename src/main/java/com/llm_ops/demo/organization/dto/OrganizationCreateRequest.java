package com.llm_ops.demo.organization.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record OrganizationCreateRequest(
    @NotBlank(message = "조직 이름은 필수입니다.")
    @Size(max = 100, message = "조직 이름은 100자를 초과할 수 없습니다.")
    String name
) {}
