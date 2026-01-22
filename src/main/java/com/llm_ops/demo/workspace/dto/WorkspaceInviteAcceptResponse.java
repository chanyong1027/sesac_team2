package com.llm_ops.demo.workspace.dto;

import com.llm_ops.demo.organization.domain.Organization;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.domain.WorkspaceInvitationLink;
import com.llm_ops.demo.workspace.domain.WorkspaceRole;
import java.util.Objects;

/**
 * 워크스페이스 초대 수락 응답 DTO
 *
 * @param organizationId 가입된 조직 ID
 * @param organizationName 조직 이름
 * @param workspaceId 가입된 워크스페이스 ID
 * @param workspaceName 워크스페이스 이름
 * @param role 부여된 역할
 */
public record WorkspaceInviteAcceptResponse(
    Long organizationId,
    String organizationName,
    Long workspaceId,
    String workspaceName,
    WorkspaceRole role
) {
    /**
     * 정적 팩토리 메서드
     *
     * @param invitation 초대 링크 엔티티 (workspace, organization이 로드되어 있어야 함)
     * @return 응답 DTO
     * @throws NullPointerException invitation, workspace, organization 중 하나라도 null인 경우
     */
    public static WorkspaceInviteAcceptResponse from(WorkspaceInvitationLink invitation) {
        Objects.requireNonNull(invitation, "WorkspaceInvitationLink must not be null");

        Workspace workspace = invitation.getWorkspace();
        Objects.requireNonNull(workspace, "Workspace must not be null (JOIN FETCH 누락 가능성)");

        Organization organization = workspace.getOrganization();
        Objects.requireNonNull(organization, "Organization must not be null (JOIN FETCH 누락 가능성)");

        return new WorkspaceInviteAcceptResponse(
            organization.getId(),
            organization.getName(),
            workspace.getId(),
            workspace.getDisplayName(),
            invitation.getRole()
        );
    }
}
