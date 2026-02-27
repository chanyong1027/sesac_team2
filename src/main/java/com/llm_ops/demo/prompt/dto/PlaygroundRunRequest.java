package com.llm_ops.demo.prompt.dto;

import com.llm_ops.demo.keys.domain.ProviderType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.Map;

public record PlaygroundRunRequest(
    @NotNull(message = "Provider는 필수입니다.")
    ProviderType provider,

    @NotBlank(message = "모델명은 필수입니다.")
    String model,

    String systemPrompt,

    @NotBlank(message = "userTemplate는 필수입니다.")
    String userTemplate,

    Boolean ragEnabled,

    Map<String, Object> modelConfig,

    @NotNull(message = "variables는 필수입니다.")
    Map<String, String> variables,

    Long baseVersionId
) {}
