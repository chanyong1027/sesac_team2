package com.llm_ops.demo.prompt.controller;

import com.llm_ops.demo.prompt.dto.PromptReleaseHistoryResponse;
import com.llm_ops.demo.prompt.dto.PromptReleaseRequest;
import com.llm_ops.demo.prompt.dto.PromptReleaseResponse;
import com.llm_ops.demo.prompt.dto.PromptRollbackRequest;
import com.llm_ops.demo.prompt.service.PromptReleaseService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/prompts/{promptId}")
@RequiredArgsConstructor
public class PromptReleaseController {

    private final PromptReleaseService promptReleaseService;

    @PostMapping("/release")
    public ResponseEntity<PromptReleaseResponse> release(
            @PathVariable Long promptId,
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody PromptReleaseRequest request) {
        PromptReleaseResponse response = promptReleaseService.release(promptId, userId, request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/history")
    public ResponseEntity<List<PromptReleaseHistoryResponse>> getHistory(
            @PathVariable Long promptId,
            @AuthenticationPrincipal Long userId) {
        List<PromptReleaseHistoryResponse> response = promptReleaseService.getHistory(promptId, userId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/release")
    public ResponseEntity<PromptReleaseResponse> getCurrentRelease(
            @PathVariable Long promptId,
            @AuthenticationPrincipal Long userId) {
        PromptReleaseResponse response = promptReleaseService.getCurrentRelease(promptId, userId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/rollback")
    public ResponseEntity<PromptReleaseResponse> rollback(
            @PathVariable Long promptId,
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody PromptRollbackRequest request) {
        PromptReleaseResponse response = promptReleaseService.rollback(promptId, userId, request);
        return ResponseEntity.ok(response);
    }
}
