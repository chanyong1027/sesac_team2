package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.rag.config.RagSearchProperties;
import com.llm_ops.demo.rag.dto.RagSearchResponse;
import com.llm_ops.demo.rag.rerank.CohereRerankClient;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.document.Document;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RagSearchServiceUnitTest {

    @Mock
    private RagHybridSearchService ragHybridSearchService;

    @Mock
    private CohereRerankClient cohereRerankClient;

    @Test
    @DisplayName("topK 파라미터가 하이브리드 검색에 전달된다")
    void topK_parameter_passed() {
        RagSearchProperties properties = new RagSearchProperties();
        properties.setTopK(5);
        properties.setSimilarityThreshold(0.0);

        RagSearchService ragSearchService = new RagSearchService(ragHybridSearchService, properties, cohereRerankClient);
        when(ragHybridSearchService.search(anyLong(), anyString(), anyInt(), anyDouble(), eq(true))).thenReturn(List.of());

        ragSearchService.search(1L, "query", 10, null);

        ArgumentCaptor<Integer> captor = ArgumentCaptor.forClass(Integer.class);
        verify(ragHybridSearchService).search(eq(1L), eq("query"), captor.capture(), eq(0.0), eq(true));
        assertThat(captor.getValue()).isEqualTo(10);
    }

    @Test
    @DisplayName("similarityThreshold 파라미터가 전달된다")
    void similarity_threshold_passed() {
        RagSearchProperties properties = new RagSearchProperties();
        properties.setTopK(5);
        properties.setSimilarityThreshold(0.0);

        RagSearchService ragSearchService = new RagSearchService(ragHybridSearchService, properties, cohereRerankClient);
        when(ragHybridSearchService.search(anyLong(), anyString(), anyInt(), anyDouble(), eq(true))).thenReturn(List.of());

        ragSearchService.search(1L, "query", null, 0.75);

        verify(ragHybridSearchService).search(eq(1L), eq("query"), eq(5), eq(0.75), eq(true));
    }

    @Test
    @DisplayName("topK와 threshold가 null일 때 기본값이 적용된다")
    void default_values_used() {
        RagSearchProperties properties = new RagSearchProperties();
        properties.setTopK(5);
        properties.setSimilarityThreshold(0.5);

        RagSearchService ragSearchService = new RagSearchService(ragHybridSearchService, properties, cohereRerankClient);
        when(ragHybridSearchService.search(anyLong(), anyString(), anyInt(), anyDouble(), eq(true))).thenReturn(List.of());

        ragSearchService.search(1L, "query", null, null);

        verify(ragHybridSearchService).search(eq(1L), eq("query"), eq(5), eq(0.5), eq(true));
    }

    @Test
    @DisplayName("후보가 없으면 빈 응답을 반환한다")
    void empty_candidates_return_empty() {
        RagSearchProperties properties = new RagSearchProperties();
        properties.setTopK(5);
        properties.setSimilarityThreshold(0.0);

        RagSearchService ragSearchService = new RagSearchService(ragHybridSearchService, properties, cohereRerankClient);
        when(ragHybridSearchService.search(anyLong(), anyString(), anyInt(), anyDouble(), eq(true))).thenReturn(List.of());

        RagSearchResponse response = ragSearchService.search(1L, "query", null, null);
        assertThat(response.chunks()).isEmpty();
    }

    @Test
    @DisplayName("리랭크 결과가 있을 때 순서가 반영된다")
    void rerank_applies_order() {
        RagSearchProperties properties = new RagSearchProperties();
        properties.setTopK(2);
        properties.setSimilarityThreshold(0.0);

        RagSearchService ragSearchService = new RagSearchService(ragHybridSearchService, properties, cohereRerankClient);
        List<Document> candidates = List.of(
            doc("A", "alpha"),
            doc("B", "beta")
        );
        when(ragHybridSearchService.search(anyLong(), anyString(), anyInt(), anyDouble(), eq(true))).thenReturn(candidates);

        CohereRerankClient.RerankResult r1 = new CohereRerankClient.RerankResult();
        r1.index = 1;
        r1.relevance_score = 0.9;
        CohereRerankClient.RerankResult r2 = new CohereRerankClient.RerankResult();
        r2.index = 0;
        r2.relevance_score = 0.1;
        when(cohereRerankClient.rerank(anyString(), any(), anyInt())).thenReturn(List.of(r1, r2));

        RagSearchResponse response = ragSearchService.search(
            1L,
            "query",
            new RagSearchService.RagSearchOptions(2, 0.0, true, true, 2)
        );
        assertThat(response.chunks()).hasSize(2);
        assertThat(response.chunks().get(0).content()).contains("beta");
    }

    @Test
    @DisplayName("workspaceId가 null이면 예외")
    void invalid_workspaceId() {
        RagSearchProperties properties = new RagSearchProperties();
        RagSearchService ragSearchService = new RagSearchService(ragHybridSearchService, properties, cohereRerankClient);
        assertThatThrownBy(() -> ragSearchService.search(null, "query", null, null))
            .isInstanceOf(BusinessException.class);
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
