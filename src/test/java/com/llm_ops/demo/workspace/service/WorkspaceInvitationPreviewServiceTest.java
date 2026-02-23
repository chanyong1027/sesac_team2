package com.llm_ops.demo.workspace.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.organization.domain.Organization;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.domain.WorkspaceInvitationLink;
import com.llm_ops.demo.workspace.domain.WorkspaceRole;
import com.llm_ops.demo.workspace.dto.WorkspaceInvitePreviewResponse;
import com.llm_ops.demo.workspace.repository.WorkspaceInvitationLinkRepository;
import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class WorkspaceInvitationPreviewServiceTest {

    @InjectMocks
    private WorkspaceInvitationPreviewService previewService;

    @Mock
    private WorkspaceInvitationLinkRepository invitationLinkRepository;

    private Workspace workspace;
    private WorkspaceInvitationLink invitation;

    @BeforeEach
    void setUp() throws Exception {
        User inviter = createUser(100L, "inviter@example.com", "초대한 사용자");
        Organization organization = createOrganization(1L, "테스트조직", inviter);
        workspace = createWorkspace(10L, organization, "test-workspace", "테스트 워크스페이스");
        invitation = WorkspaceInvitationLink.create(workspace, WorkspaceRole.MEMBER, inviter);
    }

    @Nested
    @DisplayName("초대 프리뷰 조회 성공")
    class PreviewSuccess {

        @Test
        @DisplayName("유효한 토큰이면 프리뷰 정보를 반환한다")
        void preview_유효한_토큰이면_프리뷰를_반환한다() {
            // given
            String token = invitation.getToken();
            given(invitationLinkRepository.findByTokenWithWorkspaceOrganizationAndCreator(token))
                .willReturn(Optional.of(invitation));

            // when
            WorkspaceInvitePreviewResponse response = previewService.preview(token);

            // then
            assertThat(response.organizationId()).isEqualTo(1L);
            assertThat(response.organizationName()).isEqualTo("테스트조직");
            assertThat(response.workspaceId()).isEqualTo(10L);
            assertThat(response.workspaceName()).isEqualTo("테스트 워크스페이스");
            assertThat(response.role()).isEqualTo(WorkspaceRole.MEMBER);
            assertThat(response.inviterName()).isEqualTo("초대한 사용자");
            assertThat(response.status()).isEqualTo(WorkspaceInvitePreviewResponse.InvitationPreviewStatus.VALID);
            assertThat(response.expiresAt()).isAfter(LocalDateTime.now());
        }
    }

    @Nested
    @DisplayName("초대 프리뷰 조회 실패")
    class PreviewFail {

        @Test
        @DisplayName("토큰이 비어있으면 예외가 발생한다")
        void preview_토큰이_비어있으면_예외가_발생한다() {
            // when // then
            assertThatThrownBy(() -> previewService.preview(""))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_INPUT_VALUE);
        }

        @Test
        @DisplayName("토큰이 존재하지 않으면 예외가 발생한다")
        void preview_토큰이_존재하지_않으면_예외가_발생한다() {
            // given
            String token = "not-exists-token";
            given(invitationLinkRepository.findByTokenWithWorkspaceOrganizationAndCreator(token))
                .willReturn(Optional.empty());

            // when // then
            assertThatThrownBy(() -> previewService.preview(token))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
        }

        @Test
        @DisplayName("만료된 토큰이면 예외가 발생한다")
        void preview_만료된_토큰이면_예외가_발생한다() throws Exception {
            // given
            String token = invitation.getToken();
            setField(invitation, "expiredAt", LocalDateTime.now().minusDays(1));
            given(invitationLinkRepository.findByTokenWithWorkspaceOrganizationAndCreator(token))
                .willReturn(Optional.of(invitation));

            // when // then
            assertThatThrownBy(() -> previewService.preview(token))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_INPUT_VALUE);
        }

        @Test
        @DisplayName("비활성화된 워크스페이스면 예외가 발생한다")
        void preview_비활성화된_워크스페이스면_예외가_발생한다() {
            // given
            String token = invitation.getToken();
            workspace.deactivate();
            given(invitationLinkRepository.findByTokenWithWorkspaceOrganizationAndCreator(token))
                .willReturn(Optional.of(invitation));

            // when // then
            assertThatThrownBy(() -> previewService.preview(token))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_INPUT_VALUE);
        }

        @Test
        @DisplayName("OWNER 역할 초대 토큰이면 예외가 발생한다")
        void preview_OWNER_역할_토큰이면_예외가_발생한다() throws Exception {
            // given
            User inviter = createUser(200L, "owner-inviter@example.com", "관리자");
            WorkspaceInvitationLink ownerInvitation = WorkspaceInvitationLink.create(workspace, WorkspaceRole.OWNER, inviter);
            String token = ownerInvitation.getToken();
            given(invitationLinkRepository.findByTokenWithWorkspaceOrganizationAndCreator(token))
                .willReturn(Optional.of(ownerInvitation));

            // when // then
            assertThatThrownBy(() -> previewService.preview(token))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_INPUT_VALUE);
        }
    }

    private User createUser(Long id, String email, String name) throws Exception {
        User user = User.create(email, "password123!", name);
        setField(user, "id", id);
        return user;
    }

    private Organization createOrganization(Long id, String name, User creator) throws Exception {
        Organization organization = Organization.create(name, creator);
        setField(organization, "id", id);
        return organization;
    }

    private Workspace createWorkspace(Long id, Organization organization, String name, String displayName)
        throws Exception {
        Workspace ws = Workspace.create(organization, name, displayName);
        setField(ws, "id", id);
        return ws;
    }

    private void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = findField(target.getClass(), fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private Field findField(Class<?> clazz, String fieldName) throws NoSuchFieldException {
        try {
            return clazz.getDeclaredField(fieldName);
        } catch (NoSuchFieldException e) {
            if (clazz.getSuperclass() != null) {
                return findField(clazz.getSuperclass(), fieldName);
            }
            throw e;
        }
    }
}
