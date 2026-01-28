package com.llm_ops.demo.prompt.dto;

import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import java.time.LocalDateTime;

public record PromptVersionSummaryResponse(
    Long id,
    Integer versionNo,
    String title,
    ProviderType provider,
    String model,
    Long createdBy,
    LocalDateTime createdAt
) {
    /**
     * Create a PromptVersionSummaryResponse DTO from a PromptVersion domain object.
     *
     * @param version the source PromptVersion to convert
     * @return a PromptVersionSummaryResponse containing id, versionNo, title, provider, model, creator id, and createdAt
     */
    public static PromptVersionSummaryResponse from(PromptVersion version) {
        return new PromptVersionSummaryResponse(
            version.getId(),
            version.getVersionNo(),
            version.getTitle(),
            version.getProvider(),
            version.getModel(),
            version.getCreatedBy().getId(),
            version.getCreatedAt()
        );
    }
}