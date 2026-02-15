package com.llm_ops.demo.eval.controller;

import com.llm_ops.demo.eval.dto.EvalReleaseCriteriaResponse;
import com.llm_ops.demo.eval.dto.EvalReleaseCriteriaUpdateRequest;
import com.llm_ops.demo.eval.service.EvalReleaseCriteriaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/eval/release-criteria")
@RequiredArgsConstructor
public class WorkspaceEvalReleaseCriteriaController {

    private final EvalReleaseCriteriaService evalReleaseCriteriaService;

    @GetMapping
    public ResponseEntity<EvalReleaseCriteriaResponse> get(
            @PathVariable Long workspaceId,
            @AuthenticationPrincipal Long userId
    ) {
        return ResponseEntity.ok(evalReleaseCriteriaService.get(workspaceId, userId));
    }

    @PutMapping
    public ResponseEntity<EvalReleaseCriteriaResponse> update(
            @PathVariable Long workspaceId,
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody EvalReleaseCriteriaUpdateRequest request
    ) {
        return ResponseEntity.ok(evalReleaseCriteriaService.upsert(workspaceId, userId, request));
    }
}
