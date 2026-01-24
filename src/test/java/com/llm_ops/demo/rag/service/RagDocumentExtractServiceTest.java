package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.document.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
class RagDocumentExtractServiceTest {

    @Autowired
    private RagDocumentExtractService ragDocumentExtractService;

    @Test
    @DisplayName("문서에서 텍스트를 추출한다")
    void 문서에서_텍스트를_추출한다() {
        // given
        Long workspaceId = 1L;
        Resource resource = new ClassPathResource("rag/sample.txt");

        // when
        List<Document> documents = ragDocumentExtractService.extract(workspaceId, resource);

        // then
        assertThat(documents).isNotEmpty();
        Document document = documents.get(0);
        assertThat(document.getContent()).contains("Hello RAG");
        assertThat(document.getMetadata()).containsEntry("workspace_id", workspaceId);
    }

    @Test
    @DisplayName("빈 문서면 예외가 발생한다")
    void 빈_문서면_예외가_발생한다() {
        // given
        Long workspaceId = 1L;
        Resource resource = new ClassPathResource("rag/empty.txt");

        // when & then
        assertThatThrownBy(() -> ragDocumentExtractService.extract(workspaceId, resource))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> {
                    BusinessException businessException = (BusinessException) exception;
                    assertThat(businessException.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT_VALUE);
                });
    }

    @Test
    @DisplayName("리소스가 없으면 예외가 발생한다")
    void 리소스가_없으면_예외가_발생한다() {
        // given
        Long workspaceId = 1L;
        Resource resource = new ClassPathResource("rag/missing.txt");

        // when & then
        assertThatThrownBy(() -> ragDocumentExtractService.extract(workspaceId, resource))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> {
                    BusinessException businessException = (BusinessException) exception;
                    assertThat(businessException.getErrorCode()).isEqualTo(ErrorCode.INTERNAL_SERVER_ERROR);
                });
    }
}
