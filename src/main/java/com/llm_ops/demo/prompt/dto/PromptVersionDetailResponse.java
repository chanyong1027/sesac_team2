package com.llm_ops.demo.prompt.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import java.time.LocalDateTime;
import java.util.Map;

public record PromptVersionDetailResponse(
    Long id,
    Long promptId,
    @JsonProperty("versionNumber") Integer versionNo,
    String title,
    ProviderType provider,
    String model,
    String systemPrompt,
    String userTemplate,
    Map<String, Object> modelConfig,
    Long createdBy,
    LocalDateTime createdAt
) {
    public static PromptVersionDetailResponse from(PromptVersion version) {
        return new PromptVersionDetailResponse(
            version.getId(),
            version.getPrompt().getId(),
            version.getVersionNo(),
            version.getTitle(),
            version.getProvider(),
            version.getModel(),
            version.getSystemPrompt(),
            version.getUserTemplate(),
            version.getModelConfig(),
            version.getCreatedBy().getId(),
            version.getCreatedAt()
        );
    }
}
