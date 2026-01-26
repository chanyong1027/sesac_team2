package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.rag.config.RagSearchProperties;
import com.llm_ops.demo.rag.dto.RagSearchResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RagSearchServiceTest {

    @Mock
    private VectorStore vectorStore;

    @Test
    @DisplayName("검색 결과를 chunk 응답으로 매핑한다")
    void 검색_결과를_chunk_응답으로_매핑한다() {
        // given
        RagSearchProperties properties = new RagSearchProperties();
        properties.setTopK(5);
        properties.setSimilarityThreshold(0.0);
        RagSearchService ragSearchService = new RagSearchService(vectorStore, properties);

        Document document = Document.builder()
                .content("hello")
                .metadata(Map.of("document_name", "sample.pdf"))
                .score(0.87)
                .build();
        when(vectorStore.similaritySearch(org.mockito.ArgumentMatchers.any(SearchRequest.class)))
                .thenReturn(List.of(document));

        // when
        RagSearchResponse response = ragSearchService.search(1L, "query", null, null);

        // then
        assertThat(response.chunks()).hasSize(1);
        assertThat(response.chunks().get(0).content()).isEqualTo("hello");
        assertThat(response.chunks().get(0).score()).isEqualTo(0.87);
        assertThat(response.chunks().get(0).documentName()).isEqualTo("sample.pdf");

        ArgumentCaptor<SearchRequest> captor = ArgumentCaptor.forClass(SearchRequest.class);
        verify(vectorStore).similaritySearch(captor.capture());
        SearchRequest request = captor.getValue();
        assertThat(request.getQuery()).isEqualTo("query");
        assertThat(request.getTopK()).isEqualTo(5);
        assertThat(request.hasFilterExpression()).isTrue();
        assertThat(request.getFilterExpression().toString()).contains("workspace_id");
    }

    @Test
    @DisplayName("query가 비어 있으면 예외가 발생한다")
    void query가_비어_있으면_예외가_발생한다() {
        // given
        RagSearchProperties properties = new RagSearchProperties();
        RagSearchService ragSearchService = new RagSearchService(vectorStore, properties);

        // when & then
        assertThatThrownBy(() -> ragSearchService.search(1L, "  ", null, null))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> {
                    BusinessException businessException = (BusinessException) exception;
                    assertThat(businessException.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT_VALUE);
                });
    }
}
