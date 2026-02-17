package com.llm_ops.demo.prompt.controller;

import com.llm_ops.demo.prompt.dto.PlaygroundRunRequest;
import com.llm_ops.demo.prompt.dto.PlaygroundRunResponse;
import com.llm_ops.demo.prompt.dto.PlaygroundSaveVersionRequest;
import com.llm_ops.demo.prompt.dto.PlaygroundSaveVersionResponse;
import com.llm_ops.demo.prompt.service.PromptPlaygroundService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/prompts/{promptId}/playground")
@RequiredArgsConstructor
public class PromptPlaygroundController {

    private final PromptPlaygroundService promptPlaygroundService;

    @PostMapping("/run")
    public ResponseEntity<PlaygroundRunResponse> run(
            @PathVariable Long promptId,
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody PlaygroundRunRequest request) {
        PlaygroundRunResponse response = promptPlaygroundService.run(promptId, userId, request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/save")
    public ResponseEntity<PlaygroundSaveVersionResponse> save(
            @PathVariable Long promptId,
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody PlaygroundSaveVersionRequest request) {
        PlaygroundSaveVersionResponse response = promptPlaygroundService.saveAsVersion(promptId, userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
