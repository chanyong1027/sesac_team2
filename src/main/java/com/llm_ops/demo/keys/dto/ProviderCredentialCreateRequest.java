package com.llm_ops.demo.keys.dto;

import jakarta.validation.constraints.NotBlank;

public record ProviderCredentialCreateRequest(
        @NotBlank String provider,
        @NotBlank String apiKey
) {
}
