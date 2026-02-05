package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.rag.config.RagHybridSearchProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RagHybridSearchServiceTest {

    @Mock
    private VectorStore vectorStore;

    @Mock
    private RagKeywordSearchService ragKeywordSearchService;

    @Mock
    private ObjectProvider<RagKeywordSearchService> ragKeywordSearchServiceProvider;

    private RagHybridSearchService ragHybridSearchService;

    @BeforeEach
    void setUp() {
        RagHybridSearchProperties properties = new RagHybridSearchProperties();
        properties.setVectorTopK(3);
        properties.setKeywordTopK(3);
        properties.setCandidateTopK(10);
        properties.setRrfK(60);
        when(ragKeywordSearchServiceProvider.getIfAvailable()).thenReturn(ragKeywordSearchService);
        ragHybridSearchService = new RagHybridSearchService(vectorStore, ragKeywordSearchServiceProvider, properties);
    }

    @Test
    @DisplayName("RRF 결합 시 공통 문서가 상위에 온다")
    void rrf_fusion_prioritizes_overlap() {
        List<Document> vectorResults = List.of(
            doc("A", "alpha"),
            doc("B", "beta"),
            doc("C", "gamma")
        );
        List<Document> keywordResults = List.of(
            doc("B", "beta"),
            doc("C", "gamma"),
            doc("D", "delta")
        );

        when(vectorStore.similaritySearch(any(SearchRequest.class))).thenReturn(vectorResults);
        when(ragKeywordSearchService.search(eq(1L), anyString(), anyInt())).thenReturn(keywordResults);

        List<Document> results = ragHybridSearchService.search(1L, "query", 3, 0.0, true);

        assertThat(results.get(0).getId()).isEqualTo("B");
        assertThat(results).extracting(Document::getId).contains("A", "B", "C", "D");
    }

    private Document doc(String id, String content) {
        return Document.builder()
            .id(id)
            .text(content)
            .metadata(Map.of())
            .score(0.0)
            .build();
    }
}
