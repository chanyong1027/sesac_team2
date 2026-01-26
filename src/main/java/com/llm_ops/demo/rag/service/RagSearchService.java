package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.rag.config.RagSearchProperties;
import com.llm_ops.demo.rag.dto.ChunkDetailResponse;
import com.llm_ops.demo.rag.dto.RagSearchResponse;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.ai.vectorstore.filter.FilterExpressionBuilder;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@ConditionalOnBean(VectorStore.class)
@ConditionalOnProperty(prefix = "rag.vectorstore.pgvector", name = "enabled", havingValue = "true")
public class RagSearchService {

    private final VectorStore vectorStore;
    private final RagSearchProperties ragSearchProperties;

    public RagSearchService(VectorStore vectorStore, RagSearchProperties ragSearchProperties) {
        this.vectorStore = vectorStore;
        this.ragSearchProperties = ragSearchProperties;
    }

    public RagSearchResponse search(Long workspaceId, String query, Integer topK, Double similarityThreshold) {
        validateInput(workspaceId, query, topK, similarityThreshold);

        int resolvedTopK = topK != null ? topK : ragSearchProperties.getTopK();
        double resolvedThreshold = similarityThreshold != null
                ? similarityThreshold
                : ragSearchProperties.getSimilarityThreshold();

        FilterExpressionBuilder filterBuilder = new FilterExpressionBuilder();
        SearchRequest request = SearchRequest.query(query)
                .withTopK(resolvedTopK)
                .withSimilarityThreshold(resolvedThreshold)
                .withFilterExpression(filterBuilder.eq("workspace_id", workspaceId).build());

        List<ChunkDetailResponse> chunks = vectorStore.similaritySearch(request)
                .stream()
                .map(ChunkDetailResponse::from)
                .toList();

        return new RagSearchResponse(chunks);
    }

    private void validateInput(Long workspaceId, String query, Integer topK, Double similarityThreshold) {
        if (workspaceId == null || workspaceId <= 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "workspaceId가 필요합니다.");
        }
        if (query == null || query.trim().isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "query가 필요합니다.");
        }
        if (topK != null && topK <= 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "topK는 1 이상이어야 합니다.");
        }
        if (similarityThreshold != null && similarityThreshold < 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "similarityThreshold는 0 이상이어야 합니다.");
        }
    }
}
