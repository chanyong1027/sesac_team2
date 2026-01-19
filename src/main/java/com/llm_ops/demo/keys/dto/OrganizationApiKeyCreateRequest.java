package com.llm_ops.demo.keys.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record OrganizationApiKeyCreateRequest(
        @NotBlank @Size(min = 2, max = 100) String name
) {
}

