package com.llm_ops.demo.prompt.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import java.time.LocalDateTime;

public record PromptVersionCreateResponse(
    Long id,
    Long promptId,
    @JsonProperty("versionNumber") Integer versionNo,
    LocalDateTime createdAt
) {
    public static PromptVersionCreateResponse from(PromptVersion version) {
        return new PromptVersionCreateResponse(
            version.getId(),
            version.getPrompt().getId(),
            version.getVersionNo(),
            version.getCreatedAt()
        );
    }
}
