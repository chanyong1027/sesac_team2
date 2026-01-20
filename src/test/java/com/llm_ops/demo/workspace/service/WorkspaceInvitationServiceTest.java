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
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.domain.WorkspaceInvitationLink;
import com.llm_ops.demo.workspace.domain.WorkspaceMember;
import com.llm_ops.demo.workspace.domain.WorkspaceRole;
import com.llm_ops.demo.workspace.domain.WorkspaceStatus;
import com.llm_ops.demo.workspace.dto.WorkspaceInviteCreateRequest;
import com.llm_ops.demo.workspace.dto.WorkspaceInviteCreateResponse;
import com.llm_ops.demo.workspace.repository.WorkspaceInvitationLinkRepository;
import com.llm_ops.demo.workspace.repository.WorkspaceMemberRepository;
import com.llm_ops.demo.workspace.repository.WorkspaceRepository;
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
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class WorkspaceInvitationServiceTest {

    @InjectMocks
    private WorkspaceInvitationService workspaceInvitationService;

    @Mock
    private WorkspaceInvitationLinkRepository invitationLinkRepository;

    @Mock
    private WorkspaceRepository workspaceRepository;

    @Mock
    private WorkspaceMemberRepository workspaceMemberRepository;

    @Mock
    private UserRepository userRepository;

    private User mockUser;
    private Organization mockOrganization;
    private Workspace mockWorkspace;
    private WorkspaceMember mockOwnerMember;

    @BeforeEach
    void setUp() throws Exception {
        ReflectionTestUtils.setField(workspaceInvitationService, "baseUrl", "http://localhost:3000");

        mockUser = createMockUser(1L, "test@example.com", "테스트 유저");
        mockOrganization = createMockOrganization(1L, "테스트 조직", mockUser);
        mockWorkspace = createMockWorkspace(1L, mockOrganization, "test-workspace", "테스트 워크스페이스");
        mockOwnerMember = createMockWorkspaceMember(1L, mockWorkspace, mockUser, WorkspaceRole.OWNER);
    }

    @Nested
    @DisplayName("초대 링크 생성")
    class CreateInvitation {

        @Test
        @DisplayName("초대 링크를 성공적으로 생성한다")
        void createInvitation_Success() {
            // given
            Long workspaceId = 1L;
            Long userId = 1L;
            WorkspaceInviteCreateRequest request = new WorkspaceInviteCreateRequest(WorkspaceRole.MEMBER);

            given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
            given(workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE))
                .willReturn(Optional.of(mockWorkspace));
            given(workspaceMemberRepository.findByWorkspaceAndUser(mockWorkspace, mockUser))
                .willReturn(Optional.of(mockOwnerMember));
            given(invitationLinkRepository.save(any(WorkspaceInvitationLink.class)))
                .willAnswer(invocation -> {
                    WorkspaceInvitationLink link = invocation.getArgument(0);
                    setId(link, 1L);
                    return link;
                });

            // when
            WorkspaceInviteCreateResponse response = workspaceInvitationService.createInvitation(
                workspaceId, userId, request
            );

            // then
            assertThat(response).isNotNull();
            assertThat(response.token()).isNotNull();
            assertThat(response.token()).hasSize(36);
            assertThat(response.role()).isEqualTo(WorkspaceRole.MEMBER);
            assertThat(response.invitationUrl()).contains(response.token());
            assertThat(response.expiredAt()).isAfter(LocalDateTime.now());

            verify(invitationLinkRepository).save(any(WorkspaceInvitationLink.class));
        }

        @Test
        @DisplayName("토큰이 UUID 형식이다")
        void createInvitation_TokenIsUUID() {
            // given
            Long workspaceId = 1L;
            Long userId = 1L;
            WorkspaceInviteCreateRequest request = new WorkspaceInviteCreateRequest(WorkspaceRole.MEMBER);

            given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
            given(workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE))
                .willReturn(Optional.of(mockWorkspace));
            given(workspaceMemberRepository.findByWorkspaceAndUser(mockWorkspace, mockUser))
                .willReturn(Optional.of(mockOwnerMember));
            given(invitationLinkRepository.save(any(WorkspaceInvitationLink.class)))
                .willAnswer(invocation -> invocation.getArgument(0));

            // when
            WorkspaceInviteCreateResponse response = workspaceInvitationService.createInvitation(
                workspaceId, userId, request
            );

            // then
            String uuidPattern = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";
            assertThat(response.token()).matches(uuidPattern);
        }

        @Test
        @DisplayName("만료일이 7일 후이다")
        void createInvitation_ExpirationIs7Days() {
            // given
            Long workspaceId = 1L;
            Long userId = 1L;
            WorkspaceInviteCreateRequest request = new WorkspaceInviteCreateRequest(WorkspaceRole.MEMBER);
            LocalDateTime before = LocalDateTime.now().plusDays(7).minusMinutes(1);
            LocalDateTime after = LocalDateTime.now().plusDays(7).plusMinutes(1);

            given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
            given(workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE))
                .willReturn(Optional.of(mockWorkspace));
            given(workspaceMemberRepository.findByWorkspaceAndUser(mockWorkspace, mockUser))
                .willReturn(Optional.of(mockOwnerMember));
            given(invitationLinkRepository.save(any(WorkspaceInvitationLink.class)))
                .willAnswer(invocation -> invocation.getArgument(0));

            // when
            WorkspaceInviteCreateResponse response = workspaceInvitationService.createInvitation(
                workspaceId, userId, request
            );

            // then
            assertThat(response.expiredAt()).isAfter(before);
            assertThat(response.expiredAt()).isBefore(after);
        }
    }

    @Nested
    @DisplayName("초대 링크 생성 실패")
    class CreateInvitationFail {

        @Test
        @DisplayName("존재하지 않는 사용자로 생성 시 예외가 발생한다")
        void createInvitation_UserNotFound_ThrowsException() {
            // given
            Long workspaceId = 1L;
            Long userId = 999L;
            WorkspaceInviteCreateRequest request = new WorkspaceInviteCreateRequest(WorkspaceRole.MEMBER);

            given(userRepository.findById(userId)).willReturn(Optional.empty());

            // when & then
            assertThatThrownBy(() -> workspaceInvitationService.createInvitation(workspaceId, userId, request))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);

            verify(invitationLinkRepository, never()).save(any());
        }

        @Test
        @DisplayName("존재하지 않는 워크스페이스로 생성 시 예외가 발생한다")
        void createInvitation_WorkspaceNotFound_ThrowsException() {
            // given
            Long workspaceId = 999L;
            Long userId = 1L;
            WorkspaceInviteCreateRequest request = new WorkspaceInviteCreateRequest(WorkspaceRole.MEMBER);

            given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
            given(workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE))
                .willReturn(Optional.empty());

            // when & then
            assertThatThrownBy(() -> workspaceInvitationService.createInvitation(workspaceId, userId, request))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);

            verify(invitationLinkRepository, never()).save(any());
        }

        @Test
        @DisplayName("워크스페이스 멤버가 아니면 예외가 발생한다")
        void createInvitation_NotWorkspaceMember_ThrowsException() {
            // given
            Long workspaceId = 1L;
            Long userId = 1L;
            WorkspaceInviteCreateRequest request = new WorkspaceInviteCreateRequest(WorkspaceRole.MEMBER);

            given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
            given(workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE))
                .willReturn(Optional.of(mockWorkspace));
            given(workspaceMemberRepository.findByWorkspaceAndUser(mockWorkspace, mockUser))
                .willReturn(Optional.empty());

            // when & then
            assertThatThrownBy(() -> workspaceInvitationService.createInvitation(workspaceId, userId, request))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);

            verify(invitationLinkRepository, never()).save(any());
        }

        @Test
        @DisplayName("OWNER가 아니면 예외가 발생한다")
        void createInvitation_NotOwner_ThrowsException() throws Exception {
            // given
            Long workspaceId = 1L;
            Long userId = 1L;
            WorkspaceInviteCreateRequest request = new WorkspaceInviteCreateRequest(WorkspaceRole.MEMBER);

            WorkspaceMember memberRole = createMockWorkspaceMember(2L, mockWorkspace, mockUser, WorkspaceRole.MEMBER);

            given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
            given(workspaceRepository.findByIdAndStatus(workspaceId, WorkspaceStatus.ACTIVE))
                .willReturn(Optional.of(mockWorkspace));
            given(workspaceMemberRepository.findByWorkspaceAndUser(mockWorkspace, mockUser))
                .willReturn(Optional.of(memberRole));

            // when & then
            assertThatThrownBy(() -> workspaceInvitationService.createInvitation(workspaceId, userId, request))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);

            verify(invitationLinkRepository, never()).save(any());
        }
    }

    private User createMockUser(Long id, String email, String name) throws Exception {
        User user = User.create(email, "encodedPassword", name);
        setId(user, id);
        return user;
    }

    private Organization createMockOrganization(Long id, String name, User creator) throws Exception {
        Organization org = Organization.create(name, creator);
        setId(org, id);
        return org;
    }

    private Workspace createMockWorkspace(Long id, Organization org, String name, String displayName) throws Exception {
        Workspace workspace = Workspace.create(org, name, displayName);
        setId(workspace, id);
        return workspace;
    }

    private WorkspaceMember createMockWorkspaceMember(Long id, Workspace workspace, User user, WorkspaceRole role) throws Exception {
        WorkspaceMember member = WorkspaceMember.create(workspace, user, role);
        setId(member, id);
        return member;
    }

    private void setId(Object entity, Long id) throws Exception {
        Field idField = entity.getClass().getDeclaredField("id");
        idField.setAccessible(true);
        idField.set(entity, id);
    }
}
