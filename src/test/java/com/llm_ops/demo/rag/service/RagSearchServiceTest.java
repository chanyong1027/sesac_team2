package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.rag.config.RagSearchProperties;
import com.llm_ops.demo.rag.dto.RagSearchResponse;
import com.llm_ops.demo.rag.metadata.RagMetadataKeys;
import com.llm_ops.demo.rag.rerank.CohereRerankClient;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.document.Document;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RagSearchServiceTest {

    @Mock
    private RagHybridSearchService ragHybridSearchService;

    @Mock
    private CohereRerankClient cohereRerankClient;

    @Test
    @DisplayName("검색 결과를 chunk 응답으로 매핑한다")
    void 검색_결과를_chunk_응답으로_매핑한다() {
        RagSearchProperties properties = new RagSearchProperties();
        properties.setTopK(5);
        properties.setSimilarityThreshold(0.0);

        RagSearchService ragSearchService = new RagSearchService(ragHybridSearchService, properties, cohereRerankClient);

        Document document = Document.builder()
            .id("abc")
            .text("hello")
            .metadata(Map.of(RagMetadataKeys.DOCUMENT_NAME, "sample.pdf", RagMetadataKeys.DOCUMENT_ID, 10L))
            .score(0.87)
            .build();

        when(ragHybridSearchService.search(eq(1L), eq("query"), eq(5), eq(0.0), eq(true)))
            .thenReturn(List.of(document));
        RagSearchResponse response = ragSearchService.search(1L, "query", null, null);

        assertThat(response.chunks()).hasSize(1);
        assertThat(response.chunks().get(0).content()).isEqualTo("hello");
        assertThat(response.chunks().get(0).score()).isEqualTo(0.87);
        assertThat(response.chunks().get(0).documentId()).isEqualTo(10L);
        assertThat(response.chunks().get(0).documentName()).isEqualTo("sample.pdf");
    }

    @Test
    @DisplayName("query가 비어 있으면 예외가 발생한다")
    void query가_비어_있으면_예외가_발생한다() {
        RagSearchProperties properties = new RagSearchProperties();
        RagSearchService ragSearchService = new RagSearchService(ragHybridSearchService, properties, cohereRerankClient);

        assertThatThrownBy(() -> ragSearchService.search(1L, "  ", null, null))
            .isInstanceOf(BusinessException.class)
            .satisfies(exception -> {
                BusinessException businessException = (BusinessException) exception;
                assertThat(businessException.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT_VALUE);
            });
    }
}
