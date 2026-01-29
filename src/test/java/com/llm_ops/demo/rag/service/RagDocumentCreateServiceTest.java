package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.rag.domain.RagDocument;
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
class RagDocumentCreateServiceTest {

    @Autowired
    private RagDocumentCreateService ragDocumentCreateService;

    @Autowired
    private RagDocumentRepository ragDocumentRepository;

    @BeforeEach
    void setUp() {
        ragDocumentRepository.deleteAll();
    }

    @Test
    @DisplayName("문서 메타데이터를 저장한다")
    void 문서_메타데이터를_저장한다() {
        // given
        Long workspaceId = 1L;
        String fileName = "sample.pdf";
        String fileUrl = "workspaces/1/documents/test-sample.pdf";

        // when
        RagDocument saved = ragDocumentCreateService.create(workspaceId, fileName, fileUrl);

        // then
        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getWorkspaceId()).isEqualTo(workspaceId);
        assertThat(saved.getFileName()).isEqualTo(fileName);
        assertThat(saved.getFileUrl()).isEqualTo(fileUrl);
    }

    @Test
    @DisplayName("파일 정보가 비어있으면 예외가 발생한다")
    void 파일_정보가_비어있으면_예외가_발생한다() {
        // given
        Long workspaceId = 1L;

        // when & then
        assertThatThrownBy(() -> ragDocumentCreateService.create(workspaceId, " ", " "))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> {
                    BusinessException businessException = (BusinessException) exception;
                    assertThat(businessException.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT_VALUE);
                });
    }
}
