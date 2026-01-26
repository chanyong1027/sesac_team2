package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.VectorStore;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class RagDocumentVectorStoreSaveServiceTest {

    @Mock
    private VectorStore vectorStore;

    @InjectMocks
    private RagDocumentVectorStoreSaveService ragDocumentVectorStoreSaveService;

    @Test
    @DisplayName("청킹된 문서를 벡터 스토어에 저장한다")
    void 청킹된_문서를_벡터_스토어에_저장한다() {
        // given
        Long workspaceId = 1L;
        Long documentId = 10L;
        Document chunk = new Document("hello", Map.of("chunk_index", 0));

        // when
        int savedCount = ragDocumentVectorStoreSaveService.save(workspaceId, documentId, List.of(chunk));

        // then
        assertThat(savedCount).isEqualTo(1);
        ArgumentCaptor<List<Document>> captor = ArgumentCaptor.forClass(List.class);
        verify(vectorStore).add(captor.capture());
        Document saved = captor.getValue().get(0);
        assertThat(saved.getMetadata())
                .containsEntry("workspace_id", workspaceId)
                .containsEntry("document_id", documentId);
    }

    @Test
    @DisplayName("workspaceId가 없으면 예외가 발생한다")
    void workspaceId가_없으면_예외가_발생한다() {
        // given
        List<Document> chunks = List.of(new Document("hello"));

        // when & then
        assertThatThrownBy(() -> ragDocumentVectorStoreSaveService.save(null, null, chunks))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> {
                    BusinessException businessException = (BusinessException) exception;
                    assertThat(businessException.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT_VALUE);
                });
    }

    @Test
    @DisplayName("청크가 비어있으면 예외가 발생한다")
    void 청크가_비어있으면_예외가_발생한다() {
        // given
        Long workspaceId = 1L;

        // when & then
        assertThatThrownBy(() -> ragDocumentVectorStoreSaveService.save(workspaceId, null, List.of()))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> {
                    BusinessException businessException = (BusinessException) exception;
                    assertThat(businessException.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT_VALUE);
                });
    }
}
