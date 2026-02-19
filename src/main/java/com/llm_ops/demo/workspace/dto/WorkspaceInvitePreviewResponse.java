package com.llm_ops.demo.workspace.dto;

import com.llm_ops.demo.workspace.domain.WorkspaceInvitationLink;
import com.llm_ops.demo.workspace.domain.WorkspaceRole;
import java.time.LocalDateTime;
import java.util.Objects;

public record WorkspaceInvitePreviewResponse(
    Long organizationId,
    String organizationName,
    Long workspaceId,
    String workspaceName,
    WorkspaceRole role,
    String inviterName,
    LocalDateTime expiresAt,
    InvitationPreviewStatus status,
    String invitationMessage
) {
    public enum InvitationPreviewStatus {
        VALID
    }

    public static WorkspaceInvitePreviewResponse fromValid(WorkspaceInvitationLink invitation) {
        Objects.requireNonNull(invitation, "WorkspaceInvitationLink must not be null");
        Objects.requireNonNull(invitation.getWorkspace(), "Workspace must not be null");
        Objects.requireNonNull(invitation.getWorkspace().getOrganization(), "Organization must not be null");
        Objects.requireNonNull(invitation.getCreatedBy(), "CreatedBy must not be null");

        return new WorkspaceInvitePreviewResponse(
            invitation.getWorkspace().getOrganization().getId(),
            invitation.getWorkspace().getOrganization().getName(),
            invitation.getWorkspace().getId(),
            invitation.getWorkspace().getDisplayName(),
            invitation.getRole(),
            invitation.getCreatedBy().getName(),
            invitation.getExpiredAt(),
            InvitationPreviewStatus.VALID,
            null
        );
    }
}
