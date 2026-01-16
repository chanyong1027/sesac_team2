package com.llm_ops.demo.keys.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class ProviderCredentialCreateRequest {

    @NotBlank
    private String provider;

    @NotBlank
    private String apiKey;
}
