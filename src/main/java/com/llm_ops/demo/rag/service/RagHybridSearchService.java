package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.rag.config.RagHybridSearchProperties;
import com.llm_ops.demo.rag.metadata.RagMetadataKeys;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.ai.vectorstore.filter.FilterExpressionBuilder;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@ConditionalOnBean(VectorStore.class)
public class RagHybridSearchService {

    private final VectorStore vectorStore;
    private final ObjectProvider<RagKeywordSearchService> ragKeywordSearchServiceProvider;
    private final RagHybridSearchProperties properties;

    public RagHybridSearchService(
        VectorStore vectorStore,
        ObjectProvider<RagKeywordSearchService> ragKeywordSearchServiceProvider,
        RagHybridSearchProperties properties
    ) {
        this.vectorStore = vectorStore;
        this.ragKeywordSearchServiceProvider = ragKeywordSearchServiceProvider;
        this.properties = properties;
    }

    public List<Document> search(Long workspaceId, String query, int finalTopK, double similarityThreshold, boolean hybridEnabled) {
        if (!hybridEnabled || !properties.isEnabled()) {
            List<Document> vectorOnly = searchVector(workspaceId, query, finalTopK, similarityThreshold);
            return vectorOnly.size() > finalTopK ? vectorOnly.subList(0, finalTopK) : vectorOnly;
        }
        int vectorTopK = Math.max(finalTopK, properties.getVectorTopK());
        int keywordTopK = Math.max(finalTopK, properties.getKeywordTopK());
        int candidateTopK = Math.max(finalTopK, properties.getCandidateTopK());

        List<Document> vectorResults = searchVector(workspaceId, query, vectorTopK, similarityThreshold);
        RagKeywordSearchService keywordSearchService = ragKeywordSearchServiceProvider.getIfAvailable();
        List<Document> keywordResults = keywordSearchService != null
            ? keywordSearchService.search(workspaceId, query, keywordTopK)
            : List.of();

        List<Document> fused = rrfFuse(vectorResults, keywordResults, properties.getRrfK());
        if (fused.size() > candidateTopK) {
            return fused.subList(0, candidateTopK);
        }
        return fused;
    }

    private List<Document> searchVector(Long workspaceId, String query, int topK, double similarityThreshold) {
        FilterExpressionBuilder filterBuilder = new FilterExpressionBuilder();
        SearchRequest request = SearchRequest.query(query)
            .withTopK(topK)
            .withSimilarityThreshold(similarityThreshold)
            .withFilterExpression(filterBuilder.eq(RagMetadataKeys.WORKSPACE_ID, workspaceId).build());

        return vectorStore.similaritySearch(request);
    }

    private List<Document> rrfFuse(List<Document> vectorResults, List<Document> keywordResults, int rrfK) {
        Map<String, Candidate> candidates = new HashMap<>();
        addCandidates(candidates, vectorResults, rrfK);
        addCandidates(candidates, keywordResults, rrfK);

        return candidates.values().stream()
            .sorted(Comparator.comparingDouble(Candidate::score).reversed())
            .map(Candidate::toDocument)
            .toList();
    }

    private void addCandidates(Map<String, Candidate> candidates, List<Document> results, int rrfK) {
        if (results == null || results.isEmpty()) {
            return;
        }
        int rank = 1;
        for (Document document : results) {
            if (document == null || document.getId() == null) {
                continue;
            }
            String id = document.getId();
            Candidate candidate = candidates.computeIfAbsent(id, key -> new Candidate(document));
            candidate.addScore(1.0 / (rrfK + rank));
            rank++;
        }
    }

    private static class Candidate {
        private final Document base;
        private double score;

        private Candidate(Document base) {
            this.base = base;
        }

        private void addScore(double score) {
            this.score += score;
        }

        private double score() {
            return score;
        }

        private Document toDocument() {
            return Document.builder()
                .id(base.getId())
                .text(base.getContent())
                .metadata(base.getMetadata())
                .score(score)
                .build();
        }
    }
}
