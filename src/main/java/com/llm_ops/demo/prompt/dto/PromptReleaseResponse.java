package com.llm_ops.demo.prompt.dto;

import com.llm_ops.demo.prompt.domain.PromptRelease;
import java.time.LocalDateTime;

public record PromptReleaseResponse(
    Long promptId,
    Long activeVersionId,
    Integer activeVersionNo,
    LocalDateTime releasedAt
) {
    public static PromptReleaseResponse from(PromptRelease release) {
        return new PromptReleaseResponse(
            release.getPromptId(),
            release.getActiveVersion().getId(),
            release.getActiveVersion().getVersionNo(),
            release.getUpdatedAt()
        );
    }
}
