package com.llm_ops.demo.workspace.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.llm_ops.demo.workspace.domain.WorkspaceStatus;
import com.llm_ops.demo.workspace.dto.WorkspaceCreateRequest;
import com.llm_ops.demo.workspace.dto.WorkspaceCreateResponse;
import com.llm_ops.demo.workspace.service.WorkspaceService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class WorkspaceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private WorkspaceService workspaceService;

    @Test
    @DisplayName("워크스페이스 생성 API 성공")
    void createWorkspace_Success() throws Exception {
        // given
        Long orgId = 1L;
        Long userId = 1L;
        WorkspaceCreateRequest request = new WorkspaceCreateRequest("production", "프로덕션 환경");
        WorkspaceCreateResponse response = new WorkspaceCreateResponse(
            1L,
            "production",
            "프로덕션 환경",
            WorkspaceStatus.ACTIVE
        );

        given(workspaceService.create(eq(orgId), eq(userId), any(WorkspaceCreateRequest.class)))
            .willReturn(response);

        // when & then
        mockMvc.perform(post("/api/v1/organizations/{orgId}/workspaces", orgId)
                .header("X-User-Id", userId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(1L))
            .andExpect(jsonPath("$.name").value("production"))
            .andExpect(jsonPath("$.displayName").value("프로덕션 환경"))
            .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    @DisplayName("워크스페이스 식별자 누락 시 검증 실패")
    void createWorkspace_BlankName_ValidationFails() throws Exception {
        // given
        Long orgId = 1L;
        Long userId = 1L;
        WorkspaceCreateRequest request = new WorkspaceCreateRequest("", "프로덕션 환경");

        // when & then
        mockMvc.perform(post("/api/v1/organizations/{orgId}/workspaces", orgId)
                .header("X-User-Id", userId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andDo(print())
            .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("워크스페이스 식별자 패턴 오류 시 검증 실패")
    void createWorkspace_InvalidNamePattern_ValidationFails() throws Exception {
        // given
        Long orgId = 1L;
        Long userId = 1L;
        WorkspaceCreateRequest request = new WorkspaceCreateRequest("Production_Test", "프로덕션 환경");

        // when & then
        mockMvc.perform(post("/api/v1/organizations/{orgId}/workspaces", orgId)
                .header("X-User-Id", userId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andDo(print())
            .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("워크스페이스 이름 누락 시 검증 실패")
    void createWorkspace_BlankDisplayName_ValidationFails() throws Exception {
        // given
        Long orgId = 1L;
        Long userId = 1L;
        WorkspaceCreateRequest request = new WorkspaceCreateRequest("production", "");

        // when & then
        mockMvc.perform(post("/api/v1/organizations/{orgId}/workspaces", orgId)
                .header("X-User-Id", userId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andDo(print())
            .andExpect(status().isBadRequest());
    }
}
