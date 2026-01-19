package com.llm_ops.demo.workspace.dto;

import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.domain.WorkspaceStatus;

public record WorkspaceCreateResponse(
    Long id,
    String name,
    String displayName,
    WorkspaceStatus status
) {
    public static WorkspaceCreateResponse from(Workspace workspace) {
        return new WorkspaceCreateResponse(
            workspace.getId(),
            workspace.getName(),
            workspace.getDisplayName(),
            workspace.getStatus()
        );
    }
}
