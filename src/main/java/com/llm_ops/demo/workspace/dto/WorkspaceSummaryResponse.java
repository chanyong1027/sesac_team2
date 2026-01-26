package com.llm_ops.demo.workspace.dto;

import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.domain.WorkspaceMember;
import com.llm_ops.demo.workspace.domain.WorkspaceRole;
import com.llm_ops.demo.workspace.domain.WorkspaceStatus;
import java.time.LocalDateTime;
import java.util.Objects;

public record WorkspaceSummaryResponse(
    Long id,
    Long organizationId,
    String organizationName,
    String name,
    String displayName,
    WorkspaceStatus status,
    WorkspaceRole myRole,
    LocalDateTime createdAt
) {
    public static WorkspaceSummaryResponse from(WorkspaceMember member) {
        Objects.requireNonNull(member, "WorkspaceMember must not be null");

        Workspace workspace = member.getWorkspace();
        return new WorkspaceSummaryResponse(
            workspace.getId(),
            workspace.getOrganization().getId(),
            workspace.getOrganization().getName(),
            workspace.getName(),
            workspace.getDisplayName(),
            workspace.getStatus(),
            member.getRole(),
            workspace.getCreatedAt()
        );
    }
}
