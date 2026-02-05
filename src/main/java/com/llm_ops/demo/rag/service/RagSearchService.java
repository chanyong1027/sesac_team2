package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.rag.config.RagSearchProperties;
import com.llm_ops.demo.rag.dto.ChunkDetailResponse;
import com.llm_ops.demo.rag.dto.RagSearchResponse;
import com.llm_ops.demo.rag.rerank.CohereRerankClient;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@ConditionalOnBean(RagHybridSearchService.class)
@ConditionalOnProperty(prefix = "rag.vectorstore.pgvector", name = "enabled", havingValue = "true")
public class RagSearchService {

    private final RagHybridSearchService ragHybridSearchService;
    private final RagSearchProperties ragSearchProperties;
    private final CohereRerankClient cohereRerankClient;

    public record RagSearchOptions(
        int topK,
        double similarityThreshold,
        boolean hybridEnabled,
        boolean rerankEnabled,
        int rerankTopN
    ) {
    }

    public RagSearchService(
        RagHybridSearchService ragHybridSearchService,
        RagSearchProperties ragSearchProperties,
        CohereRerankClient cohereRerankClient
    ) {
        this.ragHybridSearchService = ragHybridSearchService;
        this.ragSearchProperties = ragSearchProperties;
        this.cohereRerankClient = cohereRerankClient;
    }

    public RagSearchResponse search(Long workspaceId, String query) {
        return search(workspaceId, query, null, null);
    }

    public RagSearchResponse search(Long workspaceId, String query, Integer topK, Double similarityThreshold) {
        validateInput(workspaceId, query, topK, similarityThreshold);

        RagSearchOptions options = new RagSearchOptions(
            topK != null ? topK : ragSearchProperties.getTopK(),
            similarityThreshold != null ? similarityThreshold : ragSearchProperties.getSimilarityThreshold(),
            true,
            false,
            10
        );
        return search(workspaceId, query, options);
    }

    public RagSearchResponse search(Long workspaceId, String query, RagSearchOptions options) {
        if (options == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "options가 필요합니다.");
        }

        List<org.springframework.ai.document.Document> candidates = ragHybridSearchService.search(
            workspaceId,
            query,
            options.topK(),
            options.similarityThreshold(),
            options.hybridEnabled()
        );

        List<org.springframework.ai.document.Document> reranked = options.rerankEnabled()
            ? rerankWithTopN(query, candidates, options.topK(), options.rerankTopN())
            : candidates;

        List<ChunkDetailResponse> chunks = reranked.stream()
            .limit(options.topK())
            .map(ChunkDetailResponse::from)
            .toList();

        return new RagSearchResponse(chunks);
    }

    private List<org.springframework.ai.document.Document> rerankWithTopN(
        String query,
        List<org.springframework.ai.document.Document> candidates,
        int topK,
        int rerankTopN
    ) {
        if (candidates == null || candidates.isEmpty()) {
            return List.of();
        }
        List<String> documents = candidates.stream()
            .map(org.springframework.ai.document.Document::getContent)
            .toList();

        int requestedTopN = Math.max(topK, rerankTopN);
        List<CohereRerankClient.RerankResult> results = cohereRerankClient.rerank(query, documents, requestedTopN);
        if (results == null || results.isEmpty()) {
            return candidates;
        }

        Map<Integer, CohereRerankClient.RerankResult> byIndex = results.stream()
            .filter(r -> r.index >= 0 && r.index < candidates.size())
            .collect(Collectors.toMap(r -> r.index, r -> r, (a, b) -> a));

        return byIndex.entrySet().stream()
            .sorted((a, b) -> Double.compare(b.getValue().relevance_score, a.getValue().relevance_score))
            .map(entry -> {
                org.springframework.ai.document.Document doc = candidates.get(entry.getKey());
                return org.springframework.ai.document.Document.builder()
                    .id(doc.getId())
                    .text(doc.getContent())
                    .metadata(doc.getMetadata())
                    .score(entry.getValue().relevance_score)
                    .build();
            })
            .toList();
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
