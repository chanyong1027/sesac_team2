package com.llm_ops.demo.prompt.dto;

import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptStatus;
import java.time.LocalDateTime;

public record PromptSummaryResponse(
    Long id,
    String promptKey,
    String description,
    PromptStatus status,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
    public static PromptSummaryResponse from(Prompt prompt) {
        return new PromptSummaryResponse(
            prompt.getId(),
            prompt.getPromptKey(),
            prompt.getDescription(),
            prompt.getStatus(),
            prompt.getCreatedAt(),
            prompt.getUpdatedAt()
        );
    }
}
