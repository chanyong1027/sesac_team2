package com.llm_ops.demo.workspace.dto;

import com.llm_ops.demo.workspace.domain.WorkspaceRagSettings;

public record WorkspaceRagSettingsResponse(
    Long workspaceId,
    Integer topK,
    Double similarityThreshold,
    Integer maxChunks,
    Integer maxContextChars
) {
    public static WorkspaceRagSettingsResponse from(WorkspaceRagSettings settings) {
        return new WorkspaceRagSettingsResponse(
            settings.getWorkspace().getId(),
            settings.getTopK(),
            settings.getSimilarityThreshold(),
            settings.getMaxChunks(),
            settings.getMaxContextChars()
        );
    }
}
