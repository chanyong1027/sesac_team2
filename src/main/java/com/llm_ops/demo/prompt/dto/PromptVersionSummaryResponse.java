package com.llm_ops.demo.prompt.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import java.time.LocalDateTime;

public record PromptVersionSummaryResponse(
    Long id,
    @JsonProperty("versionNumber") Integer versionNo,
    String title,
    ProviderType provider,
    String model,
    ProviderType secondaryProvider,
    String secondaryModel,
    boolean ragEnabled,
    Long createdBy,
    String createdByName,
    LocalDateTime createdAt
) {
    public static PromptVersionSummaryResponse from(PromptVersion version) {
        return new PromptVersionSummaryResponse(
            version.getId(),
            version.getVersionNo(),
            version.getTitle(),
            version.getProvider(),
            version.getModel(),
            version.getSecondaryProvider(),
            version.getSecondaryModel(),
            version.isRagEnabled(),
            version.getCreatedBy().getId(),
            version.getCreatedBy().getName(),
            version.getCreatedAt()
        );
    }
}
