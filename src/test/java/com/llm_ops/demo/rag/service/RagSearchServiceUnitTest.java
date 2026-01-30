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
class RagSearchServiceUnitTest {

    @Mock
    private VectorStore vectorStore;

    @Test
    @DisplayName("topK 파라미터가 SearchRequest에 올바르게 적용된다")
    void topK_파라미터_테스트() {
        // given
        RagSearchProperties properties = new RagSearchProperties();
        properties.setTopK(5);
        properties.setSimilarityThreshold(0.0);
        RagSearchService ragSearchService = new RagSearchService(vectorStore, properties);

        when(vectorStore.similaritySearch(org.mockito.ArgumentMatchers.any(SearchRequest.class)))
                .thenReturn(List.of());

        // when
        ragSearchService.search(1L, "query", 10, null);

        // then
        ArgumentCaptor<SearchRequest> captor = ArgumentCaptor.forClass(SearchRequest.class);
        verify(vectorStore).similaritySearch(captor.capture());
        SearchRequest request = captor.getValue();
        assertThat(request.getTopK()).isEqualTo(10);
    }

    @Test
    @DisplayName("similarityThreshold 파라미터가 올바르게 적용된다")
    void similarityThreshold_파라미터_테스트() {
        // given
        RagSearchProperties properties = new RagSearchProperties();
        properties.setTopK(5);
        properties.setSimilarityThreshold(0.0);
        RagSearchService ragSearchService = new RagSearchService(vectorStore, properties);

        when(vectorStore.similaritySearch(org.mockito.ArgumentMatchers.any(SearchRequest.class)))
                .thenReturn(List.of());

        // when
        ragSearchService.search(1L, "query", null, 0.75);

        // then
        ArgumentCaptor<SearchRequest> captor = ArgumentCaptor.forClass(SearchRequest.class);
        verify(vectorStore).similaritySearch(captor.capture());
        SearchRequest request = captor.getValue();
        assertThat(request.getSimilarityThreshold()).isEqualTo(0.75);
    }

    @Test
    @DisplayName("topK와 threshold가 null일 때 기본값이 적용된다")
    void 기본값_적용_테스트() {
        // given
        RagSearchProperties properties = new RagSearchProperties();
        properties.setTopK(5);
        properties.setSimilarityThreshold(0.5);
        RagSearchService ragSearchService = new RagSearchService(vectorStore, properties);

        when(vectorStore.similaritySearch(org.mockito.ArgumentMatchers.any(SearchRequest.class)))
                .thenReturn(List.of());

        // when
        ragSearchService.search(1L, "query", null, null);

        // then
        ArgumentCaptor<SearchRequest> captor = ArgumentCaptor.forClass(SearchRequest.class);
        verify(vectorStore).similaritySearch(captor.capture());
        SearchRequest request = captor.getValue();
        assertThat(request.getTopK()).isEqualTo(5);
        assertThat(request.getSimilarityThreshold()).isEqualTo(0.5);
    }

    @Test
    @DisplayName("VectorStore가 빈 리스트를 반환할 때 빈 응답을 반환한다")
    void 빈_결과_테스트() {
        // given
        RagSearchProperties properties = new RagSearchProperties();
        properties.setTopK(5);
        properties.setSimilarityThreshold(0.0);
        RagSearchService ragSearchService = new RagSearchService(vectorStore, properties);

        when(vectorStore.similaritySearch(org.mockito.ArgumentMatchers.any(SearchRequest.class)))
                .thenReturn(List.of());

        // when
        RagSearchResponse response = ragSearchService.search(1L, "query", null, null);

        // then
        assertThat(response.chunks()).isEmpty();
    }

    @Test
    @DisplayName("FilterExpression에 workspace_id가 포함된다")
    void workspace_id_필터링_테스트() {
        // given
        RagSearchProperties properties = new RagSearchProperties();
        properties.setTopK(5);
        properties.setSimilarityThreshold(0.0);
        RagSearchService ragSearchService = new RagSearchService(vectorStore, properties);

        when(vectorStore.similaritySearch(org.mockito.ArgumentMatchers.any(SearchRequest.class)))
                .thenReturn(List.of());

        // when
        ragSearchService.search(42L, "query", null, null);

        // then
        ArgumentCaptor<SearchRequest> captor = ArgumentCaptor.forClass(SearchRequest.class);
        verify(vectorStore).similaritySearch(captor.capture());
        SearchRequest request = captor.getValue();
        assertThat(request.hasFilterExpression()).isTrue();
        assertThat(request.getFilterExpression().toString()).contains("workspace_id");
    }

    @Test
    @DisplayName("workspaceId가 null이면 예외가 발생한다")
    void workspaceId_null_유효성_검사_테스트() {
        // given
        RagSearchProperties properties = new RagSearchProperties();
        RagSearchService ragSearchService = new RagSearchService(vectorStore, properties);

        // when & then
        assertThatThrownBy(() -> ragSearchService.search(null, "query", null, null))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> {
                    BusinessException businessException = (BusinessException) exception;
                    assertThat(businessException.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT_VALUE);
                });
    }

    @Test
    @DisplayName("workspaceId가 0 이하이면 예외가 발생한다")
    void workspaceId_음수_유효성_검사_테스트() {
        // given
        RagSearchProperties properties = new RagSearchProperties();
        RagSearchService ragSearchService = new RagSearchService(vectorStore, properties);

        // when & then
        assertThatThrownBy(() -> ragSearchService.search(0L, "query", null, null))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> {
                    BusinessException businessException = (BusinessException) exception;
                    assertThat(businessException.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT_VALUE);
                });
    }

    @Test
    @DisplayName("query가 null이면 예외가 발생한다")
    void query_null_유효성_검사_테스트() {
        // given
        RagSearchProperties properties = new RagSearchProperties();
        RagSearchService ragSearchService = new RagSearchService(vectorStore, properties);

        // when & then
        assertThatThrownBy(() -> ragSearchService.search(1L, null, null, null))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> {
                    BusinessException businessException = (BusinessException) exception;
                    assertThat(businessException.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT_VALUE);
                });
    }

    @Test
    @DisplayName("query가 빈 문자열이면 예외가 발생한다")
    void query_빈문자열_유효성_검사_테스트() {
        // given
        RagSearchProperties properties = new RagSearchProperties();
        RagSearchService ragSearchService = new RagSearchService(vectorStore, properties);

        // when & then
        assertThatThrownBy(() -> ragSearchService.search(1L, "", null, null))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> {
                    BusinessException businessException = (BusinessException) exception;
                    assertThat(businessException.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT_VALUE);
                });
    }

    @Test
    @DisplayName("topK가 0 이하이면 예외가 발생한다")
    void topK_음수_유효성_검사_테스트() {
        // given
        RagSearchProperties properties = new RagSearchProperties();
        RagSearchService ragSearchService = new RagSearchService(vectorStore, properties);

        // when & then
        assertThatThrownBy(() -> ragSearchService.search(1L, "query", 0, null))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> {
                    BusinessException businessException = (BusinessException) exception;
                    assertThat(businessException.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT_VALUE);
                });
    }

    @Test
    @DisplayName("similarityThreshold가 음수이면 예외가 발생한다")
    void similarityThreshold_음수_유효성_검사_테스트() {
        // given
        RagSearchProperties properties = new RagSearchProperties();
        RagSearchService ragSearchService = new RagSearchService(vectorStore, properties);

        // when & then
        assertThatThrownBy(() -> ragSearchService.search(1L, "query", null, -0.1))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> {
                    BusinessException businessException = (BusinessException) exception;
                    assertThat(businessException.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT_VALUE);
                });
    }

    @Test
    @DisplayName("여러 문서가 반환될 때 모두 응답에 포함된다")
    void 여러_문서_응답_테스트() {
        // given
        RagSearchProperties properties = new RagSearchProperties();
        properties.setTopK(5);
        properties.setSimilarityThreshold(0.0);
        RagSearchService ragSearchService = new RagSearchService(vectorStore, properties);

        Document doc1 = Document.builder()
                .content("content1")
                .metadata(Map.of("document_name", "doc1.pdf"))
                .score(0.9)
                .build();
        Document doc2 = Document.builder()
                .content("content2")
                .metadata(Map.of("document_name", "doc2.pdf"))
                .score(0.8)
                .build();
        when(vectorStore.similaritySearch(org.mockito.ArgumentMatchers.any(SearchRequest.class)))
                .thenReturn(List.of(doc1, doc2));

        // when
        RagSearchResponse response = ragSearchService.search(1L, "query", null, null);

        // then
        assertThat(response.chunks()).hasSize(2);
        assertThat(response.chunks().get(0).content()).isEqualTo("content1");
        assertThat(response.chunks().get(1).content()).isEqualTo("content2");
    }
}
