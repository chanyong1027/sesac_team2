package com.llm_ops.demo.prompt.dto;

import com.llm_ops.demo.prompt.domain.PromptVersion;
import java.time.LocalDateTime;

public record PromptVersionCreateResponse(
    Long id,
    Long promptId,
    Integer versionNo,
    LocalDateTime createdAt
) {
    /**
     * Create a PromptVersionCreateResponse DTO from a PromptVersion domain object.
     *
     * @param version the domain PromptVersion to convert
     * @return a PromptVersionCreateResponse populated with id, promptId, versionNo, and createdAt from the given domain object
     */
    public static PromptVersionCreateResponse from(PromptVersion version) {
        return new PromptVersionCreateResponse(
            version.getId(),
            version.getPrompt().getId(),
            version.getVersionNo(),
            version.getCreatedAt()
        );
    }
}