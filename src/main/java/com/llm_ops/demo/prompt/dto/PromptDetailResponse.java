package com.llm_ops.demo.prompt.dto;

import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptStatus;
import java.time.LocalDateTime;

public record PromptDetailResponse(
    Long id,
    Long workspaceId,
    String promptKey,
    String description,
    PromptStatus status,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
    public static PromptDetailResponse from(Prompt prompt) {
        return new PromptDetailResponse(
            prompt.getId(),
            prompt.getWorkspace().getId(),
            prompt.getPromptKey(),
            prompt.getDescription(),
            prompt.getStatus(),
            prompt.getCreatedAt(),
            prompt.getUpdatedAt()
        );
    }
}
