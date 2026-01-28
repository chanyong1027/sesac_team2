package com.llm_ops.demo.workspace.controller;

import com.llm_ops.demo.workspace.dto.WorkspaceCreateRequest;
import com.llm_ops.demo.workspace.dto.WorkspaceCreateResponse;
import com.llm_ops.demo.workspace.dto.WorkspaceSummaryResponse;
import com.llm_ops.demo.workspace.service.WorkspaceListService;
import com.llm_ops.demo.workspace.service.WorkspaceService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class WorkspaceController {

    private final WorkspaceService workspaceService;
    private final WorkspaceListService workspaceListService;

    @GetMapping("/workspaces")
    public ResponseEntity<List<WorkspaceSummaryResponse>> getMyWorkspaces(
        @AuthenticationPrincipal Long userId
    ) {
        List<WorkspaceSummaryResponse> response = workspaceListService.getMyWorkspaces(userId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/organizations/{orgId}/workspaces")
    public ResponseEntity<WorkspaceCreateResponse> createWorkspace(
        @PathVariable Long orgId,
        @AuthenticationPrincipal Long userId,
        @Valid @RequestBody WorkspaceCreateRequest request
    ) {
        WorkspaceCreateResponse response = workspaceService.create(orgId, userId, request);
        return ResponseEntity.ok(response);
    }
}
