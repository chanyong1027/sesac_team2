package com.llm_ops.demo.rag.controller;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.llm_ops.demo.rag.dto.ChunkDetailResponse;
import com.llm_ops.demo.rag.dto.RagSearchResponse;
import com.llm_ops.demo.rag.facade.RagSearchFacade;
import com.llm_ops.demo.rag.service.RagDocumentVectorStoreSaveService;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.test.context.TestSecurityContextHolder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@TestPropertySource(properties = "rag.vectorstore.pgvector.enabled=true")
class RagControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private RagSearchFacade ragSearchFacade;

    @MockitoBean
    private RagDocumentVectorStoreSaveService ragDocumentVectorStoreSaveService;

    @Test
    @DisplayName("RAG 검색 API 성공")
    void search_Success() throws Exception {
        // given
        Long workspaceId = 1L;
        Long userId = 1L;
        String query = "환불 정책";
        RagSearchResponse response = new RagSearchResponse(List.of(
            new ChunkDetailResponse("환불은 7일 이내 가능합니다.", 0.87, "policy.md")
        ));

        given(ragSearchFacade.search(workspaceId, userId, query)).willReturn(response);

        // when & then
        TestSecurityContextHolder.setAuthentication(
            new UsernamePasswordAuthenticationToken(userId, null, List.of())
        );
        try {
            mockMvc.perform(get("/api/v1/workspaces/{workspaceId}/rag/search", workspaceId)
                    .param("query", query))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.chunks[0].content").value("환불은 7일 이내 가능합니다."))
                .andExpect(jsonPath("$.chunks[0].score").value(0.87))
                .andExpect(jsonPath("$.chunks[0].documentName").value("policy.md"));
        } finally {
            TestSecurityContextHolder.clearContext();
        }
    }
}
