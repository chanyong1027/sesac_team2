package com.llm_ops.demo.workspace.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.llm_ops.demo.workspace.domain.WorkspaceRole;
import com.llm_ops.demo.workspace.dto.WorkspaceInviteAcceptRequest;
import com.llm_ops.demo.workspace.dto.WorkspaceInviteAcceptResponse;
import com.llm_ops.demo.workspace.service.WorkspaceInvitationAcceptService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class InvitationAcceptControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private WorkspaceInvitationAcceptService invitationAcceptService;

    @Nested
    @DisplayName("초대 수락 API 성공")
    class AcceptInvitationSuccess {

        @Test
        @DisplayName("초대 수락 API 성공")
        void acceptInvitation_Success() throws Exception {
            // given
            Long userId = 1L;
            String token = "valid-token-uuid";
            WorkspaceInviteAcceptRequest request = new WorkspaceInviteAcceptRequest(token);
            WorkspaceInviteAcceptResponse response = new WorkspaceInviteAcceptResponse(
                1L,
                "테스트조직",
                1L,
                "프로덕션",
                WorkspaceRole.MEMBER
            );

            given(invitationAcceptService.accept(eq(userId), any(WorkspaceInviteAcceptRequest.class)))
                .willReturn(response);

            // when & then
            mockMvc.perform(post("/api/v1/invitations/accept")
                    .header("X-User-Id", userId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.organizationId").value(1L))
                .andExpect(jsonPath("$.organizationName").value("테스트조직"))
                .andExpect(jsonPath("$.workspaceId").value(1L))
                .andExpect(jsonPath("$.workspaceName").value("프로덕션"))
                .andExpect(jsonPath("$.role").value("MEMBER"));
        }

        @Test
        @DisplayName("OWNER 역할로 초대 수락 성공")
        void acceptInvitation_OwnerRole_Success() throws Exception {
            // given
            Long userId = 1L;
            String token = "valid-token-uuid";
            WorkspaceInviteAcceptRequest request = new WorkspaceInviteAcceptRequest(token);
            WorkspaceInviteAcceptResponse response = new WorkspaceInviteAcceptResponse(
                1L,
                "테스트조직",
                1L,
                "프로덕션",
                WorkspaceRole.OWNER
            );

            given(invitationAcceptService.accept(eq(userId), any(WorkspaceInviteAcceptRequest.class)))
                .willReturn(response);

            // when & then
            mockMvc.perform(post("/api/v1/invitations/accept")
                    .header("X-User-Id", userId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("OWNER"));
        }
    }

    @Nested
    @DisplayName("초대 수락 API 검증 실패")
    class AcceptInvitationValidationFail {

        @Test
        @DisplayName("token 누락 시 검증 실패")
        void acceptInvitation_NullToken_ValidationFails() throws Exception {
            // given
            Long userId = 1L;
            String requestBody = "{}";

            // when & then
            mockMvc.perform(post("/api/v1/invitations/accept")
                    .header("X-User-Id", userId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(requestBody))
                .andDo(print())
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("token 빈 문자열 시 검증 실패")
        void acceptInvitation_BlankToken_ValidationFails() throws Exception {
            // given
            Long userId = 1L;
            WorkspaceInviteAcceptRequest request = new WorkspaceInviteAcceptRequest("");

            // when & then
            mockMvc.perform(post("/api/v1/invitations/accept")
                    .header("X-User-Id", userId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andDo(print())
                .andExpect(status().isBadRequest());
        }
    }
}
