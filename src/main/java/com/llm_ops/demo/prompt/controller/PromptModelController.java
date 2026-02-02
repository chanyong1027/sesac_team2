package com.llm_ops.demo.prompt.controller;

import com.llm_ops.demo.prompt.service.PromptModelAllowlistService;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/models")
public class PromptModelController {

    private final PromptModelAllowlistService promptModelAllowlistService;

    public PromptModelController(PromptModelAllowlistService promptModelAllowlistService) {
        this.promptModelAllowlistService = promptModelAllowlistService;
    }

    @GetMapping("/allowlist")
    public ResponseEntity<Map<String, List<String>>> getAllowlist() {
        return ResponseEntity.ok(promptModelAllowlistService.getAllowlist());
    }
}
