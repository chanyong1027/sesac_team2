package com.llm_ops.demo.rag.controller;

import com.llm_ops.demo.rag.dto.RagSearchResponse;
import com.llm_ops.demo.rag.facade.RagSearchFacade;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/rag")
@RequiredArgsConstructor
@Validated
@ConditionalOnProperty(prefix = "rag.vectorstore.pgvector", name = "enabled", havingValue = "true")
public class RagController {

    private final RagSearchFacade ragSearchFacade;

    @GetMapping("/search")
    public ResponseEntity<RagSearchResponse> search(
        @PathVariable Long workspaceId,
        @RequestParam @NotBlank String query,
        @RequestHeader("X-User-Id") Long userId
    ) {
        RagSearchResponse response = ragSearchFacade.search(workspaceId, userId, query);
        return ResponseEntity.ok(response);
    }
}
