package com.llm_ops.demo.keys.dto;

import jakarta.validation.constraints.NotBlank;

public record ProviderCredentialUpdateRequest(
        @NotBlank String apiKey
) {
}
