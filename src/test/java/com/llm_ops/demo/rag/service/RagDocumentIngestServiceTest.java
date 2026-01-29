package com.llm_ops.demo.rag.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.anyList;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.autoconfigure.vectorstore.pgvector.PgVectorStoreAutoConfiguration;
import org.springframework.ai.document.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = "rag.vectorstore.pgvector.enabled=true")
@ImportAutoConfiguration(exclude = PgVectorStoreAutoConfiguration.class)
class RagDocumentIngestServiceTest {

    @Autowired
    private RagDocumentIngestService ragDocumentIngestService;

    @MockBean
    private RagDocumentVectorStoreSaveService ragDocumentVectorStoreSaveService;

    @MockBean
    private RagSearchService ragSearchService;

    @MockBean
    private RagDocumentChunkService ragDocumentChunkService;

    @MockBean
    private RagDocumentExtractService ragDocumentExtractService;

    @Test
    @DisplayName("문서를 인게스트하면 벡터 저장 로직을 호출한다")
    void 문서를_인게스트하면_벡터_저장_로직을_호출한다() {
        // given
        Long workspaceId = 1L;
        Long documentId = 10L;
        Resource resource = new ClassPathResource("rag/sample.txt");
        List<Document> extracted = List.of(new Document("hello", java.util.Map.of("workspace_id", workspaceId)));
        List<Document> chunks = List.of(new Document("chunk", java.util.Map.of("workspace_id", workspaceId)));

        when(ragDocumentExtractService.extract(workspaceId, resource)).thenReturn(extracted);
        when(ragDocumentChunkService.chunk(extracted, documentId, "sample.txt")).thenReturn(chunks);
        when(ragDocumentVectorStoreSaveService.save(workspaceId, documentId, chunks)).thenReturn(chunks.size());

        // when
        int savedCount = ragDocumentIngestService.ingest(workspaceId, documentId, resource);

        // then
        assertThat(savedCount).isEqualTo(chunks.size());
        verify(ragDocumentVectorStoreSaveService).save(eq(workspaceId), eq(documentId), anyList());
    }
}
