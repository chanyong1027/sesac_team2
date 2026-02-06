package com.llm_ops.demo.workspace.dto;

import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.domain.WorkspaceStatus;

public record WorkspaceUpdateResponse(
    Long id,
    String name,
    String displayName,
    WorkspaceStatus status
) {
    public static WorkspaceUpdateResponse from(Workspace workspace) {
        return new WorkspaceUpdateResponse(
            workspace.getId(),
            workspace.getName(),
            workspace.getDisplayName(),
            workspace.getStatus()
        );
    }
}
