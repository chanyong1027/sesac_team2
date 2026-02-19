package com.llm_ops.demo.workspace.controller;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.llm_ops.demo.auth.config.SecurityConfig;
import com.llm_ops.demo.auth.jwt.JwtAccessDeniedHandler;
import com.llm_ops.demo.auth.jwt.JwtAuthenticationEntryPoint;
import com.llm_ops.demo.auth.jwt.JwtTokenProvider;
import com.llm_ops.demo.auth.service.TokenBlacklistService;
import com.llm_ops.demo.workspace.domain.WorkspaceRole;
import com.llm_ops.demo.workspace.dto.WorkspaceInvitePreviewResponse;
import com.llm_ops.demo.workspace.service.WorkspaceInvitationAcceptService;
import com.llm_ops.demo.workspace.service.WorkspaceInvitationPreviewService;
import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(InvitationAcceptController.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, JwtAccessDeniedHandler.class})
class InvitationSecurityContractTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private WorkspaceInvitationAcceptService invitationAcceptService;

    @MockitoBean
    private WorkspaceInvitationPreviewService invitationPreviewService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @MockitoBean
    private TokenBlacklistService tokenBlacklistService;

    @Test
    @DisplayName("초대 프리뷰 API는 익명 요청을 허용한다")
    void previewInvitation_익명_요청_허용() throws Exception {
        // given
        String token = "public-invite-token";
        WorkspaceInvitePreviewResponse response = new WorkspaceInvitePreviewResponse(
            3L,
            "테스트조직",
            31L,
            "마케팅 워크스페이스",
            WorkspaceRole.MEMBER,
            "초대자",
            LocalDateTime.now().plusDays(1),
            WorkspaceInvitePreviewResponse.InvitationPreviewStatus.VALID,
            null
        );
        given(invitationPreviewService.preview(eq(token))).willReturn(response);

        // when // then
        mockMvc.perform(get("/api/v1/invitations/preview").param("token", token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.organizationId").value(3L))
            .andExpect(jsonPath("$.workspaceId").value(31L))
            .andExpect(jsonPath("$.role").value("MEMBER"));
    }

    @Test
    @DisplayName("초대 수락 API는 익명 요청을 차단한다")
    void acceptInvitation_익명_요청_차단() throws Exception {
        // given
        String requestBody = """
            {
              "token": "public-invite-token"
            }
            """;

        // when // then
        mockMvc.perform(post("/api/v1/invitations/accept")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("C401"));
    }
}
