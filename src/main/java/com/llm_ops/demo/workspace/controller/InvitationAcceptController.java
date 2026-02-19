package com.llm_ops.demo.workspace.controller;

import com.llm_ops.demo.workspace.dto.WorkspaceInviteAcceptRequest;
import com.llm_ops.demo.workspace.dto.WorkspaceInviteAcceptResponse;
import com.llm_ops.demo.workspace.dto.WorkspaceInvitePreviewResponse;
import com.llm_ops.demo.workspace.service.WorkspaceInvitationAcceptService;
import com.llm_ops.demo.workspace.service.WorkspaceInvitationPreviewService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
@Validated
public class InvitationAcceptController {

    private final WorkspaceInvitationAcceptService invitationAcceptService;
    private final WorkspaceInvitationPreviewService invitationPreviewService;

    /**
     * 초대 수락
     *
     * @param userId 수락하는 사용자 ID (JWT 인증)
     * @param request 초대 토큰
     * @return 가입된 조직/워크스페이스 정보
     */
    @PostMapping("/accept")
    public ResponseEntity<WorkspaceInviteAcceptResponse> acceptInvitation(
        @AuthenticationPrincipal Long userId,
        @Valid @RequestBody WorkspaceInviteAcceptRequest request
    ) {
        WorkspaceInviteAcceptResponse response = invitationAcceptService.accept(userId, request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/preview")
    public ResponseEntity<WorkspaceInvitePreviewResponse> previewInvitation(
        @RequestParam @NotBlank(message = "초대 토큰은 필수입니다.") String token
    ) {
        WorkspaceInvitePreviewResponse response = invitationPreviewService.preview(token);
        return ResponseEntity.ok(response);
    }
}
