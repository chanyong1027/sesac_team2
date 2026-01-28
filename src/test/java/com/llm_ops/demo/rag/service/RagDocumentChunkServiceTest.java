package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.document.Document;
import org.springframework.ai.transformer.splitter.TokenTextSplitter;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;


class RagDocumentChunkServiceTest {

    private RagDocumentChunkService ragDocumentChunkService;


    @BeforeEach
    void setUp() {
        // TokenTextSplitter 직접 생성 (기본값 또는 테스트용 설정)
        TokenTextSplitter tokenTextSplitter = new TokenTextSplitter(
                5,      // chunkSize (토큰 수)
                1,      // minChunkSizeChars
                1,      // minChunkLengthToEmbed
                10000,  // maxNumChunks
                true    // keepSeparator
        );

        ragDocumentChunkService = new RagDocumentChunkService(tokenTextSplitter);
    }

    @Test
    @DisplayName("문서를 토큰 기준으로 청킹한다")
    void 문서를_토큰_기준으로_청킹한다() {
        // given
        String content = "hello ".repeat(50);
        Document document = new Document(content, Map.of("workspace_id", 1L));

        // when
        List<Document> chunks = ragDocumentChunkService.chunk(List.of(document), null);

        // then
        assertThat(chunks).isNotEmpty();
        Document first = chunks.get(0);
        assertThat(first.getMetadata()).containsKeys("chunk_index", "chunk_total");
    }

    @Test
    @DisplayName("documentId가 있으면 메타데이터에 포함된다")
    void documentId가_있으면_메타데이터에_포함된다() {
        // given
        String content = "hello ".repeat(20);
        Document document = new Document(content, Map.of("workspace_id", 1L));
        Long documentId = 10L;

        // when
        List<Document> chunks = ragDocumentChunkService.chunk(List.of(document), documentId);

        // then
        assertThat(chunks).isNotEmpty();
        assertThat(chunks.get(0).getMetadata()).containsEntry("document_id", documentId);
    }

    @Test
    @DisplayName("문서가 비어 있으면 예외가 발생한다")
    void 문서가_비어_있으면_예외가_발생한다() {
        // given
        List<Document> documents = List.of();

        // when & then
        assertThatThrownBy(() -> ragDocumentChunkService.chunk(documents, null))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> {
                    BusinessException businessException = (BusinessException) exception;
                    assertThat(businessException.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT_VALUE);
                });
    }

}
