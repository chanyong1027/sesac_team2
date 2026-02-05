package com.llm_ops.demo.rag.service;

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

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.ai.vectorstore.pgvector.enabled=false")
@ImportAutoConfiguration(exclude = PgVectorStoreAutoConfiguration.class)
class RagDocumentListServiceTest {

    @Autowired
    private RagDocumentListService ragDocumentListService;

    @Autowired
    private RagDocumentRepository ragDocumentRepository;

    @BeforeEach
    void setUp() {
        ragDocumentRepository.deleteAll();
    }

    @Test
    @DisplayName("워크스페이스의 삭제되지 않은 문서를 조회한다")
    void 워크스페이스의_삭제되지_않은_문서를_조회한다() {
        // given
        RagDocument active = ragDocumentRepository.save(
                RagDocument.create(1L, "active.pdf", "workspaces/1/documents/active.pdf")
        );
        RagDocument deleted = ragDocumentRepository.save(
                RagDocument.create(1L, "deleted.pdf", "workspaces/1/documents/deleted.pdf")
        );
        deleted.markDeleted();
        ragDocumentRepository.save(deleted);

        // when
        List<RagDocument> documents = ragDocumentListService.findActiveDocuments(1L);

        // then
        assertThat(documents).hasSize(1);
        assertThat(documents.get(0).getId()).isEqualTo(active.getId());
        assertThat(documents.get(0).getStatus()).isEqualTo(RagDocumentStatus.UPLOADED);
    }
}
