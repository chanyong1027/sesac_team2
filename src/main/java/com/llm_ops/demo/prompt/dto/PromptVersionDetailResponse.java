package com.llm_ops.demo.prompt.dto;

import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import java.time.LocalDateTime;
import java.util.Map;

public record PromptVersionDetailResponse(
    Long id,
    Long promptId,
    Integer versionNo,
    String title,
    ProviderType provider,
    String model,
    String systemPrompt,
    String userTemplate,
    Map<String, Object> modelConfig,
    Long createdBy,
    LocalDateTime createdAt
) {
    /**
     * Create a PromptVersionDetailResponse from a PromptVersion entity.
     *
     * @param version the source PromptVersion whose properties will be mapped
     * @return a PromptVersionDetailResponse containing id, promptId, versionNo, title, provider, model,
     *         systemPrompt, userTemplate, modelConfig, createdBy, and createdAt copied from the given version
     */
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