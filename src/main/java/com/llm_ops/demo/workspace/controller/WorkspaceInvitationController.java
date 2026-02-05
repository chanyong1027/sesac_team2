package com.llm_ops.demo.workspace.controller;

import com.llm_ops.demo.workspace.dto.WorkspaceInviteCreateRequest;
import com.llm_ops.demo.workspace.dto.WorkspaceInviteCreateResponse;
import com.llm_ops.demo.workspace.service.WorkspaceInvitationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces")
@RequiredArgsConstructor
public class WorkspaceInvitationController {

    private final WorkspaceInvitationService workspaceInvitationService;

    @PostMapping("/{workspaceId}/invitation-links")
    public ResponseEntity<WorkspaceInviteCreateResponse> createInvitation(
        @PathVariable Long workspaceId,
        @AuthenticationPrincipal Long userId,
        @Valid @RequestBody WorkspaceInviteCreateRequest request
    ) {
        WorkspaceInviteCreateResponse response = workspaceInvitationService.createInvitation(
            workspaceId,
            userId,
            request
        );
        return ResponseEntity.ok(response);
    }
}
