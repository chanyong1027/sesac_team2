package com.llm_ops.demo.workspace.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.llm_ops.demo.workspace.domain.WorkspaceRole;
import com.llm_ops.demo.workspace.dto.WorkspaceInviteCreateRequest;
import com.llm_ops.demo.workspace.dto.WorkspaceInviteCreateResponse;
import com.llm_ops.demo.workspace.service.WorkspaceInvitationService;
import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
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
class WorkspaceInvitationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private WorkspaceInvitationService workspaceInvitationService;

    @Nested
    @DisplayName("초대 링크 생성 API")
    class CreateInvitationApi {

        @Test
        @DisplayName("초대 링크 생성 API 성공")
        void createInvitation_Success() throws Exception {
            // given
            Long workspaceId = 1L;
            Long userId = 1L;
            WorkspaceInviteCreateRequest request = new WorkspaceInviteCreateRequest(WorkspaceRole.MEMBER);
            WorkspaceInviteCreateResponse response = new WorkspaceInviteCreateResponse(
                "http://localhost:3000/invitations/accept?token=test-token-uuid",
                "test-token-uuid",
                WorkspaceRole.MEMBER,
                LocalDateTime.now().plusDays(7)
            );

            given(workspaceInvitationService.createInvitation(
                eq(workspaceId), eq(userId), any(WorkspaceInviteCreateRequest.class))
            ).willReturn(response);

            // when & then
            mockMvc.perform(post("/api/v1/workspaces/{workspaceId}/invitation-links", workspaceId)
                    .header("X-User-Id", userId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invitationUrl").value(response.invitationUrl()))
                .andExpect(jsonPath("$.token").value(response.token()))
                .andExpect(jsonPath("$.role").value("MEMBER"))
                .andExpect(jsonPath("$.expiredAt").exists());
        }

        @Test
        @DisplayName("OWNER 역할로 초대 링크 생성 성공")
        void createInvitation_OwnerRole_Success() throws Exception {
            // given
            Long workspaceId = 1L;
            Long userId = 1L;
            WorkspaceInviteCreateRequest request = new WorkspaceInviteCreateRequest(WorkspaceRole.OWNER);
            WorkspaceInviteCreateResponse response = new WorkspaceInviteCreateResponse(
                "http://localhost:3000/invitations/accept?token=test-token-uuid",
                "test-token-uuid",
                WorkspaceRole.OWNER,
                LocalDateTime.now().plusDays(7)
            );

            given(workspaceInvitationService.createInvitation(
                eq(workspaceId), eq(userId), any(WorkspaceInviteCreateRequest.class))
            ).willReturn(response);

            // when & then
            mockMvc.perform(post("/api/v1/workspaces/{workspaceId}/invitation-links", workspaceId)
                    .header("X-User-Id", userId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("OWNER"));
        }
    }

    @Nested
    @DisplayName("초대 링크 생성 API 검증 실패")
    class CreateInvitationValidationFail {

        @Test
        @DisplayName("role 누락 시 검증 실패")
        void createInvitation_NullRole_ValidationFails() throws Exception {
            // given
            Long workspaceId = 1L;
            Long userId = 1L;
            String requestBody = "{}";

            // when & then
            mockMvc.perform(post("/api/v1/workspaces/{workspaceId}/invitation-links", workspaceId)
                    .header("X-User-Id", userId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(requestBody))
                .andDo(print())
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("잘못된 role 값 시 검증 실패")
        void createInvitation_InvalidRole_ValidationFails() throws Exception {
            // given
            Long workspaceId = 1L;
            Long userId = 1L;
            String requestBody = "{\"role\": \"INVALID_ROLE\"}";

            // when & then
            mockMvc.perform(post("/api/v1/workspaces/{workspaceId}/invitation-links", workspaceId)
                    .header("X-User-Id", userId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(requestBody))
                .andDo(print())
                .andExpect(status().isBadRequest());
        }
    }
}
