package com.llm_ops.demo.prompt.dto;

import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptStatus;
import java.time.LocalDateTime;

public record PromptCreateResponse(
    Long id,
    String promptKey,
    String description,
    PromptStatus status,
    LocalDateTime createdAt
) {
    public static PromptCreateResponse from(Prompt prompt) {
        return new PromptCreateResponse(
            prompt.getId(),
            prompt.getPromptKey(),
            prompt.getDescription(),
            prompt.getStatus(),
            prompt.getCreatedAt()
        );
    }
}
