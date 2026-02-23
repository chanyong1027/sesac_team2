package com.llm_ops.demo.workspace.controller;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.llm_ops.demo.config.TestSecurityConfig;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.workspace.domain.WorkspaceRole;
import com.llm_ops.demo.workspace.dto.WorkspaceInvitePreviewResponse;
import com.llm_ops.demo.workspace.service.WorkspaceInvitationAcceptService;
import com.llm_ops.demo.workspace.service.WorkspaceInvitationPreviewService;
import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(InvitationAcceptController.class)
@AutoConfigureMockMvc
@ActiveProfiles({"test", "mock-auth"})
@Import(TestSecurityConfig.class)
class InvitationPreviewControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private WorkspaceInvitationAcceptService invitationAcceptService;

    @MockitoBean
    private WorkspaceInvitationPreviewService invitationPreviewService;

    @Nested
    @DisplayName("초대 프리뷰 API 성공")
    class PreviewSuccess {

        @Test
        @DisplayName("유효한 토큰이면 초대 프리뷰를 반환한다")
        void previewInvitation_정상_프리뷰를_반환한다() throws Exception {
            // given
            String token = "valid-token";
            WorkspaceInvitePreviewResponse response = new WorkspaceInvitePreviewResponse(
                1L,
                "테스트조직",
                10L,
                "테스트 워크스페이스",
                WorkspaceRole.MEMBER,
                "홍길동",
                LocalDateTime.now().plusDays(3),
                WorkspaceInvitePreviewResponse.InvitationPreviewStatus.VALID,
                null
            );
            given(invitationPreviewService.preview(eq(token))).willReturn(response);

            // when // then
            mockMvc.perform(get("/api/v1/invitations/preview").param("token", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.organizationId").value(1L))
                .andExpect(jsonPath("$.organizationName").value("테스트조직"))
                .andExpect(jsonPath("$.workspaceId").value(10L))
                .andExpect(jsonPath("$.workspaceName").value("테스트 워크스페이스"))
                .andExpect(jsonPath("$.role").value("MEMBER"))
                .andExpect(jsonPath("$.inviterName").value("홍길동"))
                .andExpect(jsonPath("$.status").value("VALID"));
        }
    }

    @Nested
    @DisplayName("초대 프리뷰 API 실패")
    class PreviewFail {

        @Test
        @DisplayName("token 파라미터가 없으면 400을 반환한다")
        void previewInvitation_token_없으면_400을_반환한다() throws Exception {
            // when // then
            mockMvc.perform(get("/api/v1/invitations/preview"))
                .andDo(print())
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("token 파라미터가 빈값이면 400을 반환한다")
        void previewInvitation_token_빈값이면_400을_반환한다() throws Exception {
            // when // then
            mockMvc.perform(get("/api/v1/invitations/preview").param("token", ""))
                .andDo(print())
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("유효하지 않은 토큰이면 404를 반환한다")
        void previewInvitation_토큰이_없으면_404를_반환한다() throws Exception {
            // given
            String token = "missing-token";
            willThrow(new BusinessException(ErrorCode.NOT_FOUND, "초대 링크를 찾을 수 없습니다."))
                .given(invitationPreviewService)
                .preview(eq(token));

            // when // then
            mockMvc.perform(get("/api/v1/invitations/preview").param("token", token))
                .andDo(print())
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("만료된 토큰이면 400을 반환한다")
        void previewInvitation_만료된_토큰이면_400을_반환한다() throws Exception {
            // given
            String token = "expired-token";
            willThrow(new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "만료된 초대 링크입니다."))
                .given(invitationPreviewService)
                .preview(eq(token));

            // when // then
            mockMvc.perform(get("/api/v1/invitations/preview").param("token", token))
                .andDo(print())
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("비활성 워크스페이스 토큰이면 400을 반환한다")
        void previewInvitation_비활성_워크스페이스면_400을_반환한다() throws Exception {
            // given
            String token = "inactive-token";
            willThrow(new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "비활성화된 워크스페이스입니다."))
                .given(invitationPreviewService)
                .preview(eq(token));

            // when // then
            mockMvc.perform(get("/api/v1/invitations/preview").param("token", token))
                .andDo(print())
                .andExpect(status().isBadRequest());
        }
    }
}
