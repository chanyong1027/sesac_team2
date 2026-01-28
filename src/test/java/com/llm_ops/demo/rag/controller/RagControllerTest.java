package com.llm_ops.demo.rag.controller;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.organization.domain.Organization;
import com.llm_ops.demo.rag.dto.ChunkDetailResponse;
import com.llm_ops.demo.rag.dto.RagSearchResponse;
import com.llm_ops.demo.rag.service.RagSearchService;
import com.llm_ops.demo.rag.service.RagDocumentVectorStoreSaveService;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.domain.WorkspaceStatus;
import com.llm_ops.demo.workspace.repository.WorkspaceMemberRepository;
import com.llm_ops.demo.workspace.repository.WorkspaceRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
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
    private RagSearchService ragSearchService;

    @MockitoBean
    private RagDocumentVectorStoreSaveService ragDocumentVectorStoreSaveService;

    @MockitoBean
    private WorkspaceRepository workspaceRepository;

    @MockitoBean
    private WorkspaceMemberRepository workspaceMemberRepository;

    @MockitoBean
    private UserRepository userRepository;

    @Test
    @DisplayName("RAG 검색 API 성공")
    void search_Success() throws Exception {
        // given
        Long workspaceId = 1L;
        Long userId = 1L;
        String query = "환불 정책";
        User user = User.create("user@example.com", "encoded-password", "사용자");
        Organization organization = Organization.create("조직", user);
        Workspace workspace = Workspace.create(organization, "workspace", "워크스페이스");
        RagSearchResponse response = new RagSearchResponse(List.of(
            new ChunkDetailResponse("환불은 7일 이내 가능합니다.", 0.87, "policy.md")
        ));

        given(userRepository.findById(userId)).willReturn(Optional.of(user));
        given(workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE))
            .willReturn(Optional.of(workspace));
        given(workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user)).willReturn(true);
        given(ragSearchService.search(workspaceId, query)).willReturn(response);

        // when & then
        mockMvc.perform(get("/api/v1/workspaces/{workspaceId}/rag/search", workspaceId)
                .header("X-User-Id", userId)
                .param("query", query))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.chunks[0].content").value("환불은 7일 이내 가능합니다."))
            .andExpect(jsonPath("$.chunks[0].score").value(0.87))
            .andExpect(jsonPath("$.chunks[0].documentName").value("policy.md"));
    }
}
