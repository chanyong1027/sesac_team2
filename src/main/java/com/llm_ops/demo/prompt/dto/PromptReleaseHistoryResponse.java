package com.llm_ops.demo.prompt.dto;

import com.llm_ops.demo.prompt.domain.ChangeType;
import com.llm_ops.demo.prompt.domain.PromptReleaseHistory;
import java.time.LocalDateTime;

public record PromptReleaseHistoryResponse(
    Long id,
    Long promptId,
    Long fromVersionId,
    Integer fromVersionNo,
    Long toVersionId,
    Integer toVersionNo,
    ChangeType changeType,
    String reason,
    Long changedBy,
    LocalDateTime createdAt
) {
    public static PromptReleaseHistoryResponse from(PromptReleaseHistory history) {
        return new PromptReleaseHistoryResponse(
            history.getId(),
            history.getPrompt().getId(),
            history.getFromVersion() != null ? history.getFromVersion().getId() : null,
            history.getFromVersion() != null ? history.getFromVersion().getVersionNo() : null,
            history.getToVersion().getId(),
            history.getToVersion().getVersionNo(),
            history.getChangeType(),
            history.getReason(),
            history.getChangedBy().getId(),
            history.getCreatedAt()
        );
    }
}
