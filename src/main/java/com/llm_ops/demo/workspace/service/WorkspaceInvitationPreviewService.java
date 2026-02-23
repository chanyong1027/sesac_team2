package com.llm_ops.demo.workspace.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.workspace.domain.WorkspaceInvitationLink;
import com.llm_ops.demo.workspace.domain.WorkspaceRole;
import com.llm_ops.demo.workspace.dto.WorkspaceInvitePreviewResponse;
import com.llm_ops.demo.workspace.repository.WorkspaceInvitationLinkRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WorkspaceInvitationPreviewService {

    private final WorkspaceInvitationLinkRepository invitationLinkRepository;

    public WorkspaceInvitePreviewResponse preview(String token) {
        validateToken(token);
        WorkspaceInvitationLink invitation = invitationLinkRepository.findByTokenWithWorkspaceOrganizationAndCreator(token)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "초대 링크를 찾을 수 없습니다."));

        validateInvitation(invitation);
        return WorkspaceInvitePreviewResponse.fromValid(invitation);
    }

    private void validateToken(String token) {
        if (!StringUtils.hasText(token)) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "초대 토큰은 필수입니다.");
        }
    }

    private void validateInvitation(WorkspaceInvitationLink invitation) {
        if (invitation.isExpired()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "만료된 초대 링크입니다.");
        }

        if (!invitation.getWorkspace().isActive()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "비활성화된 워크스페이스입니다.");
        }

        if (invitation.getRole() == WorkspaceRole.OWNER) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "초대 링크로는 OWNER 역할을 부여할 수 없습니다.");
        }
    }
}
