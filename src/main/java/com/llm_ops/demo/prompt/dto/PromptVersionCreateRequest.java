package com.llm_ops.demo.prompt.dto;

import com.llm_ops.demo.keys.domain.ProviderType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Map;

public record PromptVersionCreateRequest(
    @Size(max = 100, message = "제목은 100자를 초과할 수 없습니다.")
    String title,

    @NotNull(message = "Provider는 필수입니다.")
    ProviderType provider,

    @NotBlank(message = "모델명은 필수입니다.")
    @Size(max = 100, message = "모델명은 100자를 초과할 수 없습니다.")
    String model,

    String systemPrompt,

    String userTemplate,

    Map<String, Object> modelConfig
) {}
