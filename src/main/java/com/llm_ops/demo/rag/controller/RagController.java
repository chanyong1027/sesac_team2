package com.llm_ops.demo.rag.controller;

import com.llm_ops.demo.rag.dto.RagSearchResponse;
import com.llm_ops.demo.rag.facade.RagSearchFacade;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/rag")
@Validated
@ConditionalOnBean(RagSearchFacade.class)
@ConditionalOnProperty(prefix = "rag.vectorstore.pgvector", name = "enabled", havingValue = "true")
public class RagController {

    private final RagSearchFacade ragSearchFacade;

    public RagController(RagSearchFacade ragSearchFacade) {
        this.ragSearchFacade = ragSearchFacade;
    }

    @GetMapping("/search")
    public ResponseEntity<RagSearchResponse> search(
        @PathVariable @NotNull @Positive Long workspaceId,
        @RequestParam @NotBlank String query,
        @RequestParam(required = false) @Min(1) @Max(1000) Integer topK,
        @RequestParam(required = false) @DecimalMin("0.0") @DecimalMax("1.0") Double similarityThreshold,
        @AuthenticationPrincipal @NotNull @Positive Long userId
    ) {
        RagSearchResponse response = ragSearchFacade.search(workspaceId, userId, query, topK, similarityThreshold);
        return ResponseEntity.ok(response);
    }
}
