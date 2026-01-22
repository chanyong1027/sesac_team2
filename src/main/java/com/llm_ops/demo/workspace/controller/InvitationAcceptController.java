package com.llm_ops.demo.workspace.controller;

import com.llm_ops.demo.workspace.dto.WorkspaceInviteAcceptRequest;
import com.llm_ops.demo.workspace.dto.WorkspaceInviteAcceptResponse;
import com.llm_ops.demo.workspace.service.WorkspaceInvitationAcceptService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 초대 수락 컨트롤러
 *
 * <p>워크스페이스 초대 토큰을 통한 가입 처리 담당</p>
 */
@RestController
@RequestMapping("/api/v1/invitations")
@RequiredArgsConstructor
public class InvitationAcceptController {

    private final WorkspaceInvitationAcceptService invitationAcceptService;

    /**
     * 초대 수락
     *
     * @param userId 수락하는 사용자 ID (임시 인증 헤더)
     * @param request 초대 토큰
     * @return 가입된 조직/워크스페이스 정보
     */
    @PostMapping("/accept")
    public ResponseEntity<WorkspaceInviteAcceptResponse> acceptInvitation(
        @RequestHeader("X-User-Id") Long userId,
        @Valid @RequestBody WorkspaceInviteAcceptRequest request
    ) {
        WorkspaceInviteAcceptResponse response = invitationAcceptService.accept(userId, request);
        return ResponseEntity.ok(response);
    }
}
