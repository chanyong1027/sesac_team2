package com.llm_ops.demo.rag.controller;

import com.llm_ops.demo.rag.dto.RagSearchResponse;
import com.llm_ops.demo.rag.service.RagSearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/rag")
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "rag.vectorstore.pgvector", name = "enabled", havingValue = "true")
public class RagController {

    private final RagSearchService ragSearchService;

    @GetMapping("/search")
    public ResponseEntity<RagSearchResponse> search(
        @PathVariable Long workspaceId,
        @RequestParam String query,
        @RequestHeader("X-User-Id") Long userId
    ) {
        RagSearchResponse response = ragSearchService.search(workspaceId, query, null, null);
        return ResponseEntity.ok(response);
    }
}
