package com.llm_ops.demo.prompt.controller;

import com.llm_ops.demo.prompt.dto.PromptCreateRequest;
import com.llm_ops.demo.prompt.dto.PromptCreateResponse;
import com.llm_ops.demo.prompt.dto.PromptDetailResponse;
import com.llm_ops.demo.prompt.dto.PromptSummaryResponse;
import com.llm_ops.demo.prompt.dto.PromptUpdateRequest;
import com.llm_ops.demo.prompt.service.PromptService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class PromptController {

    private final PromptService promptService;

    @PostMapping("/workspaces/{workspaceId}/prompts")
    public ResponseEntity<PromptCreateResponse> createPrompt(
        @PathVariable Long workspaceId,
        @RequestHeader("X-User-Id") Long userId,
        @Valid @RequestBody PromptCreateRequest request
    ) {
        PromptCreateResponse response = promptService.create(workspaceId, userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/workspaces/{workspaceId}/prompts")
    public ResponseEntity<List<PromptSummaryResponse>> getPrompts(
        @PathVariable Long workspaceId,
        @RequestHeader("X-User-Id") Long userId
    ) {
        List<PromptSummaryResponse> response = promptService.getList(workspaceId, userId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/prompts/{promptId}")
    public ResponseEntity<PromptDetailResponse> getPrompt(
        @PathVariable Long promptId,
        @RequestHeader("X-User-Id") Long userId
    ) {
        PromptDetailResponse response = promptService.getDetail(promptId, userId);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/prompts/{promptId}")
    public ResponseEntity<PromptDetailResponse> updatePrompt(
        @PathVariable Long promptId,
        @RequestHeader("X-User-Id") Long userId,
        @Valid @RequestBody PromptUpdateRequest request
    ) {
        PromptDetailResponse response = promptService.update(promptId, userId, request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/prompts/{promptId}")
    public ResponseEntity<Void> deletePrompt(
        @PathVariable Long promptId,
        @RequestHeader("X-User-Id") Long userId
    ) {
        promptService.delete(promptId, userId);
        return ResponseEntity.noContent().build();
    }
}
