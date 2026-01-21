package com.llm_ops.demo.workspace.service;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.organization.domain.Organization;
import com.llm_ops.demo.organization.domain.OrganizationMember;
import com.llm_ops.demo.organization.domain.OrganizationRole;
import com.llm_ops.demo.organization.repository.OrganizationMemberRepository;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.domain.WorkspaceInvitationLink;
import com.llm_ops.demo.workspace.domain.WorkspaceMember;
import com.llm_ops.demo.workspace.dto.WorkspaceInviteAcceptRequest;
import com.llm_ops.demo.workspace.dto.WorkspaceInviteAcceptResponse;
import com.llm_ops.demo.workspace.repository.WorkspaceInvitationLinkRepository;
import com.llm_ops.demo.workspace.repository.WorkspaceMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 워크스페이스 초대 수락 서비스
 *
 * <p>책임: 초대 토큰을 통한 워크스페이스/조직 멤버 가입 처리</p>
 *
 * <p>핵심 비즈니스 규칙:
 * <ul>
 *   <li>초대 토큰이 유효해야 함 (존재, 미만료, 워크스페이스 활성)</li>
 *   <li>이미 워크스페이스 멤버인 경우 가입 불가</li>
 *   <li>워크스페이스 가입 시 조직 멤버가 아니면 자동으로 조직에도 가입</li>
 * </ul>
 * </p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WorkspaceInvitationAcceptService {

    private final WorkspaceInvitationLinkRepository invitationLinkRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final OrganizationMemberRepository organizationMemberRepository;
    private final UserRepository userRepository;

    /**
     * 초대 수락 처리
     *
     * @param userId 수락하는 사용자 ID
     * @param request 초대 토큰이 담긴 요청
     * @return 가입 결과 (조직/워크스페이스 정보)
     */
    @Transactional
    public WorkspaceInviteAcceptResponse accept(Long userId, WorkspaceInviteAcceptRequest request) {
        User user = findUserById(userId);
        WorkspaceInvitationLink invitation = findInvitationByToken(request.token());

        validateInvitation(invitation);
        validateNotAlreadyMember(invitation.getWorkspace(), user);

        addWorkspaceMember(invitation, user);
        addOrganizationMemberIfNotExists(invitation.getWorkspace().getOrganization(), user);
        invitation.incrementUseCount();

        return WorkspaceInviteAcceptResponse.from(invitation);
    }

    // ========== 조회 메서드 (Single Abstraction Level) ==========

    private User findUserById(Long userId) {
        return userRepository.findById(userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "사용자를 찾을 수 없습니다."));
    }

    private WorkspaceInvitationLink findInvitationByToken(String token) {
        return invitationLinkRepository.findByTokenWithWorkspaceAndOrganization(token)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "초대 링크를 찾을 수 없습니다."));
    }

    // ========== 검증 메서드 (Early Return Pattern) ==========

    private void validateInvitation(WorkspaceInvitationLink invitation) {
        if (invitation.isExpired()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "만료된 초대 링크입니다.");
        }

        if (!invitation.getWorkspace().isActive()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "비활성화된 워크스페이스입니다.");
        }
    }

    private void validateNotAlreadyMember(Workspace workspace, User user) {
        boolean alreadyMember = workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user);
        if (alreadyMember) {
            throw new BusinessException(ErrorCode.CONFLICT, "이미 워크스페이스 멤버입니다.");
        }
    }

    // ========== 멤버 추가 메서드 ==========

    private void addWorkspaceMember(WorkspaceInvitationLink invitation, User user) {
        WorkspaceMember workspaceMember = WorkspaceMember.create(
            invitation.getWorkspace(),
            user,
            invitation.getRole()
        );
        workspaceMemberRepository.save(workspaceMember);
    }

    private void addOrganizationMemberIfNotExists(Organization organization, User user) {
        boolean alreadyOrgMember = organizationMemberRepository.existsByOrganizationAndUser(organization, user);
        if (alreadyOrgMember) {
            return;
        }

        OrganizationMember organizationMember = OrganizationMember.create(
            organization,
            user,
            OrganizationRole.MEMBER
        );
        organizationMemberRepository.save(organizationMember);
    }
}
