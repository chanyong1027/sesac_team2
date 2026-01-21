package com.llm_ops.demo.workspace.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.organization.domain.Organization;
import com.llm_ops.demo.organization.domain.OrganizationMember;
import com.llm_ops.demo.organization.repository.OrganizationMemberRepository;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.domain.WorkspaceInvitationLink;
import com.llm_ops.demo.workspace.domain.WorkspaceMember;
import com.llm_ops.demo.workspace.domain.WorkspaceRole;
import com.llm_ops.demo.workspace.dto.WorkspaceInviteAcceptRequest;
import com.llm_ops.demo.workspace.dto.WorkspaceInviteAcceptResponse;
import com.llm_ops.demo.workspace.repository.WorkspaceInvitationLinkRepository;
import com.llm_ops.demo.workspace.repository.WorkspaceMemberRepository;
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
class WorkspaceInvitationAcceptServiceTest {

    @InjectMocks
    private WorkspaceInvitationAcceptService acceptService;

    @Mock
    private WorkspaceInvitationLinkRepository invitationLinkRepository;

    @Mock
    private WorkspaceMemberRepository workspaceMemberRepository;

    @Mock
    private OrganizationMemberRepository organizationMemberRepository;

    @Mock
    private UserRepository userRepository;

    private User user;
    private Organization organization;
    private Workspace workspace;
    private WorkspaceInvitationLink invitation;

    @BeforeEach
    void setUp() throws Exception {
        user = createUser(1L, "test@example.com", "테스트유저");
        organization = createOrganization(1L, "테스트조직");
        workspace = createWorkspace(1L, organization, "production", "프로덕션");
        invitation = createInvitation(workspace, WorkspaceRole.MEMBER, LocalDateTime.now().plusDays(7));
    }

    @Nested
    @DisplayName("초대 수락 성공")
    class AcceptSuccess {

        @Test
        @DisplayName("초대를 수락하면 워크스페이스 멤버가 된다")
        void accept_Success() {
            // given
            String token = invitation.getToken();
            WorkspaceInviteAcceptRequest request = new WorkspaceInviteAcceptRequest(token);

            given(userRepository.findById(1L)).willReturn(Optional.of(user));
            given(invitationLinkRepository.findByTokenWithWorkspaceAndOrganization(token))
                .willReturn(Optional.of(invitation));
            given(workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user)).willReturn(false);
            given(organizationMemberRepository.existsByOrganizationAndUser(organization, user)).willReturn(false);

            // when
            WorkspaceInviteAcceptResponse response = acceptService.accept(1L, request);

            // then
            assertThat(response.workspaceId()).isEqualTo(workspace.getId());
            assertThat(response.organizationId()).isEqualTo(organization.getId());
            assertThat(response.role()).isEqualTo(WorkspaceRole.MEMBER);

            verify(workspaceMemberRepository).save(any(WorkspaceMember.class));
            verify(organizationMemberRepository).save(any(OrganizationMember.class));
        }

        @Test
        @DisplayName("이미 조직 멤버인 경우 조직 멤버 추가를 건너뛴다")
        void accept_AlreadyOrgMember_SkipsOrgMemberCreation() {
            // given
            String token = invitation.getToken();
            WorkspaceInviteAcceptRequest request = new WorkspaceInviteAcceptRequest(token);

            given(userRepository.findById(1L)).willReturn(Optional.of(user));
            given(invitationLinkRepository.findByTokenWithWorkspaceAndOrganization(token))
                .willReturn(Optional.of(invitation));
            given(workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user)).willReturn(false);
            given(organizationMemberRepository.existsByOrganizationAndUser(organization, user)).willReturn(true);

            // when
            acceptService.accept(1L, request);

            // then
            verify(workspaceMemberRepository).save(any(WorkspaceMember.class));
            verify(organizationMemberRepository, never()).save(any(OrganizationMember.class));
        }

        @Test
        @DisplayName("초대 수락 시 useCount가 증가한다")
        void accept_IncrementsUseCount() {
            // given
            String token = invitation.getToken();
            WorkspaceInviteAcceptRequest request = new WorkspaceInviteAcceptRequest(token);
            int initialUseCount = invitation.getUseCount();

            given(userRepository.findById(1L)).willReturn(Optional.of(user));
            given(invitationLinkRepository.findByTokenWithWorkspaceAndOrganization(token))
                .willReturn(Optional.of(invitation));
            given(workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user)).willReturn(false);
            given(organizationMemberRepository.existsByOrganizationAndUser(organization, user)).willReturn(false);

            // when
            acceptService.accept(1L, request);

            // then
            assertThat(invitation.getUseCount()).isEqualTo(initialUseCount + 1);
        }
    }

    @Nested
    @DisplayName("초대 수락 실패")
    class AcceptFailure {

        @Test
        @DisplayName("존재하지 않는 사용자로 수락 시 예외가 발생한다")
        void accept_UserNotFound_ThrowsException() {
            // given
            WorkspaceInviteAcceptRequest request = new WorkspaceInviteAcceptRequest("some-token");
            given(userRepository.findById(999L)).willReturn(Optional.empty());

            // when & then
            assertThatThrownBy(() -> acceptService.accept(999L, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND);
                });
        }

        @Test
        @DisplayName("존재하지 않는 토큰으로 수락 시 예외가 발생한다")
        void accept_TokenNotFound_ThrowsException() {
            // given
            String invalidToken = "invalid-token";
            WorkspaceInviteAcceptRequest request = new WorkspaceInviteAcceptRequest(invalidToken);

            given(userRepository.findById(1L)).willReturn(Optional.of(user));
            given(invitationLinkRepository.findByTokenWithWorkspaceAndOrganization(invalidToken))
                .willReturn(Optional.empty());

            // when & then
            assertThatThrownBy(() -> acceptService.accept(1L, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND);
                });
        }

        @Test
        @DisplayName("만료된 초대 토큰으로 수락 시 예외가 발생한다")
        void accept_ExpiredToken_ThrowsException() throws Exception {
            // given
            WorkspaceInvitationLink expiredInvitation = createInvitation(
                workspace, WorkspaceRole.MEMBER, LocalDateTime.now().minusDays(1)
            );
            String token = expiredInvitation.getToken();
            WorkspaceInviteAcceptRequest request = new WorkspaceInviteAcceptRequest(token);

            given(userRepository.findById(1L)).willReturn(Optional.of(user));
            given(invitationLinkRepository.findByTokenWithWorkspaceAndOrganization(token))
                .willReturn(Optional.of(expiredInvitation));

            // when & then
            assertThatThrownBy(() -> acceptService.accept(1L, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT_VALUE);
                });
        }

        @Test
        @DisplayName("비활성화된 워크스페이스 초대 수락 시 예외가 발생한다")
        void accept_InactiveWorkspace_ThrowsException() throws Exception {
            // given
            workspace.deactivate();
            String token = invitation.getToken();
            WorkspaceInviteAcceptRequest request = new WorkspaceInviteAcceptRequest(token);

            given(userRepository.findById(1L)).willReturn(Optional.of(user));
            given(invitationLinkRepository.findByTokenWithWorkspaceAndOrganization(token))
                .willReturn(Optional.of(invitation));

            // when & then
            assertThatThrownBy(() -> acceptService.accept(1L, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT_VALUE);
                });
        }

        @Test
        @DisplayName("이미 워크스페이스 멤버인 경우 예외가 발생한다")
        void accept_AlreadyWorkspaceMember_ThrowsException() {
            // given
            String token = invitation.getToken();
            WorkspaceInviteAcceptRequest request = new WorkspaceInviteAcceptRequest(token);

            given(userRepository.findById(1L)).willReturn(Optional.of(user));
            given(invitationLinkRepository.findByTokenWithWorkspaceAndOrganization(token))
                .willReturn(Optional.of(invitation));
            given(workspaceMemberRepository.existsByWorkspaceAndUser(workspace, user)).willReturn(true);

            // when & then
            assertThatThrownBy(() -> acceptService.accept(1L, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getErrorCode()).isEqualTo(ErrorCode.CONFLICT);
                });
        }
    }

    // ========== Helper Methods ==========

    private User createUser(Long id, String email, String name) throws Exception {
        User user = User.create(email, "password123!", name);
        setField(user, "id", id);
        return user;
    }

    private Organization createOrganization(Long id, String name) throws Exception {
        User creator = createUser(99L, "creator@example.com", "생성자");
        Organization org = Organization.create(name, creator);
        setField(org, "id", id);
        return org;
    }

    private Workspace createWorkspace(Long id, Organization organization, String name, String displayName)
        throws Exception {
        Workspace ws = Workspace.create(organization, name, displayName);
        setField(ws, "id", id);
        return ws;
    }

    private WorkspaceInvitationLink createInvitation(Workspace workspace, WorkspaceRole role, LocalDateTime expiredAt)
        throws Exception {
        User creator = createUser(99L, "creator@example.com", "생성자");
        WorkspaceInvitationLink link = WorkspaceInvitationLink.create(workspace, role, creator);
        setField(link, "expiredAt", expiredAt);
        return link;
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
