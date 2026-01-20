package com.llm_ops.demo.workspace.controller;

import com.llm_ops.demo.workspace.dto.WorkspaceCreateRequest;
import com.llm_ops.demo.workspace.dto.WorkspaceCreateResponse;
import com.llm_ops.demo.workspace.service.WorkspaceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class WorkspaceController {

    private final WorkspaceService workspaceService;

    @PostMapping("/organizations/{orgId}/workspaces")
    public ResponseEntity<WorkspaceCreateResponse> createWorkspace(
        @PathVariable Long orgId,
        @RequestHeader("X-User-Id") Long userId,
        @Valid @RequestBody WorkspaceCreateRequest request
    ) {
        WorkspaceCreateResponse response = workspaceService.create(orgId, userId, request);
        return ResponseEntity.ok(response);
    }
}
