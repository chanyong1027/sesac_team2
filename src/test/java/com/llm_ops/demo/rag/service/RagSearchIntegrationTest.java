package com.llm_ops.demo.rag.service;

import com.llm_ops.demo.rag.dto.RagSearchResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("local")
@TestPropertySource(properties = {
        "rag.embedding.openai.enabled=false",
        "rag.embedding.google-genai.enabled=true",
        "rag.embedding.google-genai.output-dimensionality=${RAG_EMBEDDING_DIM:768}",
        "rag.vectorstore.pgvector.enabled=true",
        "rag.vectorstore.pgvector.initialize-schema=true",
        "rag.vectorstore.pgvector.dimensions=${RAG_EMBEDDING_DIM:768}",
        "rag.vectorstore.pgvector.table-name=doc_chunks_v2"
})
@EnabledIfEnvironmentVariable(named = "GEMINI_API_KEY", matches = ".+")
@EnabledIfEnvironmentVariable(named = "RAG_SEARCH_IT", matches = "true")
class RagSearchIntegrationTest {

    private static final Long WORKSPACE_ID = 1L;
    private static final Long OTHER_WORKSPACE_ID = 2L;

    @Autowired
    private VectorStore vectorStore;

    @Autowired
    private RagSearchService ragSearchService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("DELETE FROM doc_chunks_v2 WHERE metadata->>'workspace_id' IN (?, ?)",
                WORKSPACE_ID.toString(),
                OTHER_WORKSPACE_ID.toString()
        );
    }

    @Test
    @DisplayName("질문과 유사한 문서 청크를 검색한다")
    void 질문과_유사한_문서_청크를_검색한다() {
        // given
        List<Document> documents = List.of(
                new Document("환불 정책은 구매 후 7일 이내 요청 가능합니다.", Map.of(
                        "workspace_id", WORKSPACE_ID,
                        "document_name", "policy.md"
                )),
                new Document("서버 점검 일정은 매주 화요일 공지됩니다.", Map.of(
                        "workspace_id", WORKSPACE_ID,
                        "document_name", "maintenance.md"
                )),
                new Document("환불은 고객센터로 문의하세요.", Map.of(
                        "workspace_id", OTHER_WORKSPACE_ID,
                        "document_name", "other-policy.md"
                ))
        );

        vectorStore.add(documents);

        // when
        RagSearchResponse response = ragSearchService.search(WORKSPACE_ID, "환불 정책", 3, 0.0);

        // then
        assertThat(response.chunks()).isNotEmpty();
        assertThat(response.chunks().stream().anyMatch(chunk ->
                "policy.md".equals(chunk.documentName()) || chunk.content().contains("환불")
        )).isTrue();
        assertThat(response.chunks().stream().noneMatch(chunk ->
                "other-policy.md".equals(chunk.documentName())
        )).isTrue();
    }
}
