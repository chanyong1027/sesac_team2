package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.rag.domain.RagDocument;
import com.llm_ops.demo.rag.domain.RagDocumentStatus;
import com.llm_ops.demo.rag.repository.RagDocumentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.ai.autoconfigure.vectorstore.pgvector.PgVectorStoreAutoConfiguration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.ai.vectorstore.pgvector.enabled=false")
@ImportAutoConfiguration(exclude = PgVectorStoreAutoConfiguration.class)
class RagDocumentDeleteServiceTest {

    @Autowired
    private RagDocumentDeleteService ragDocumentDeleteService;

    @Autowired
    private RagDocumentRepository ragDocumentRepository;

    @BeforeEach
    void setUp() {
        ragDocumentRepository.deleteAll();
    }

    @Test
    @DisplayName("문서를 삭제하면 상태가 DELETED로 변경된다")
    void 문서를_삭제하면_상태가_변경된다() {
        // given
        RagDocument saved = ragDocumentRepository.save(
                RagDocument.create(1L, "sample.pdf", "workspaces/1/documents/sample.pdf")
        );

        // when
        ragDocumentDeleteService.delete(saved.getWorkspaceId(), saved.getId());

        // then
        RagDocument updated = ragDocumentRepository.findById(saved.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(RagDocumentStatus.DELETED);
    }

    @Test
    @DisplayName("존재하지 않는 문서면 예외가 발생한다")
    void 존재하지_않는_문서면_예외가_발생한다() {
        // when & then
        assertThatThrownBy(() -> ragDocumentDeleteService.delete(1L, 999L))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> {
                    BusinessException businessException = (BusinessException) exception;
                    assertThat(businessException.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND);
                });
    }
}
