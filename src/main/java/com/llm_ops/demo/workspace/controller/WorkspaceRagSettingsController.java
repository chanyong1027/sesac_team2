package com.llm_ops.demo.workspace.controller;

import com.llm_ops.demo.workspace.dto.WorkspaceRagSettingsResponse;
import com.llm_ops.demo.workspace.dto.WorkspaceRagSettingsUpdateRequest;
import com.llm_ops.demo.workspace.service.WorkspaceRagSettingsService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/rag/settings")
@Validated
public class WorkspaceRagSettingsController {

    private final WorkspaceRagSettingsService workspaceRagSettingsService;

    public WorkspaceRagSettingsController(WorkspaceRagSettingsService workspaceRagSettingsService) {
        this.workspaceRagSettingsService = workspaceRagSettingsService;
    }

    @GetMapping
    public ResponseEntity<WorkspaceRagSettingsResponse> getSettings(
        @PathVariable @NotNull @Positive Long workspaceId,
        @AuthenticationPrincipal @NotNull @Positive Long userId
    ) {
        return ResponseEntity.ok(workspaceRagSettingsService.getSettings(workspaceId, userId));
    }

    @PutMapping
    public ResponseEntity<WorkspaceRagSettingsResponse> updateSettings(
        @PathVariable @NotNull @Positive Long workspaceId,
        @AuthenticationPrincipal @NotNull @Positive Long userId,
        @RequestBody @Valid WorkspaceRagSettingsUpdateRequest request
    ) {
        return ResponseEntity.ok(workspaceRagSettingsService.updateSettings(workspaceId, userId, request));
    }
}
