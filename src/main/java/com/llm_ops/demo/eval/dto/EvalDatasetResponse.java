package com.llm_ops.demo.eval.dto;

import com.llm_ops.demo.eval.domain.EvalDataset;
import java.time.LocalDateTime;

public record EvalDatasetResponse(
        Long id,
        Long workspaceId,
        String name,
        String description,
        Long createdBy,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static EvalDatasetResponse from(EvalDataset dataset) {
        return new EvalDatasetResponse(
                dataset.getId(),
                dataset.getWorkspaceId(),
                dataset.getName(),
                dataset.getDescription(),
                dataset.getCreatedBy(),
                dataset.getCreatedAt(),
                dataset.getUpdatedAt()
        );
    }
}
