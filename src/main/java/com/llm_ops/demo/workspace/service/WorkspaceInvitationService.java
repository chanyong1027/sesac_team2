package com.llm_ops.demo.workspace.service;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.domain.WorkspaceInvitationLink;
import com.llm_ops.demo.workspace.domain.WorkspaceMember;
import com.llm_ops.demo.workspace.domain.WorkspaceStatus;
import com.llm_ops.demo.workspace.dto.WorkspaceInviteCreateRequest;
import com.llm_ops.demo.workspace.dto.WorkspaceInviteCreateResponse;
import com.llm_ops.demo.workspace.repository.WorkspaceInvitationLinkRepository;
import com.llm_ops.demo.workspace.repository.WorkspaceMemberRepository;
import com.llm_ops.demo.workspace.repository.WorkspaceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WorkspaceInvitationService {

    private final WorkspaceInvitationLinkRepository invitationLinkRepository;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final UserRepository userRepository;

    @Value("${app.base-url:http://localhost:3000}")
    private String baseUrl;

    @Transactional
    public WorkspaceInviteCreateResponse createInvitation(
        Long workspaceId,
        Long userId,
        WorkspaceInviteCreateRequest request
    ) {
        User user = findUserById(userId);
        Workspace workspace = findActiveWorkspaceById(workspaceId);

        validateInvitationPermission(workspace, user);

        WorkspaceInvitationLink invitationLink = createAndSaveInvitationLink(workspace, request, user);

        return WorkspaceInviteCreateResponse.from(invitationLink, baseUrl);
    }

    private User findUserById(Long userId) {
        return userRepository.findById(userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    private Workspace findActiveWorkspaceById(Long workspaceId) {
        return workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    private void validateInvitationPermission(Workspace workspace, User user) {
        WorkspaceMember member = workspaceMemberRepository.findByWorkspaceAndUser(workspace, user)
            .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));

        if (!member.isOwner()) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
    }

    private WorkspaceInvitationLink createAndSaveInvitationLink(
        Workspace workspace,
        WorkspaceInviteCreateRequest request,
        User createdBy
    ) {
        WorkspaceInvitationLink invitationLink = WorkspaceInvitationLink.create(
            workspace,
            request.role(),
            createdBy
        );
        return invitationLinkRepository.save(invitationLink);
    }
}
