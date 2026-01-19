package com.llm_ops.demo.workspace.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.organization.domain.Organization;
import com.llm_ops.demo.organization.domain.OrganizationStatus;
import com.llm_ops.demo.organization.repository.OrganizationMemberRepository;
import com.llm_ops.demo.organization.repository.OrganizationRepository;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.domain.WorkspaceRole;
import com.llm_ops.demo.workspace.domain.WorkspaceStatus;
import com.llm_ops.demo.workspace.dto.WorkspaceCreateRequest;
import com.llm_ops.demo.workspace.dto.WorkspaceCreateResponse;
import com.llm_ops.demo.workspace.repository.WorkspaceMemberRepository;
import com.llm_ops.demo.workspace.repository.WorkspaceRepository;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class WorkspaceServiceTest {

    @InjectMocks
    private WorkspaceService workspaceService;

    @Mock
    private WorkspaceRepository workspaceRepository;

    @Mock
    private WorkspaceMemberRepository workspaceMemberRepository;

    @Mock
    private OrganizationRepository organizationRepository;

    @Mock
    private OrganizationMemberRepository organizationMemberRepository;

    @Mock
    private UserRepository userRepository;

    @Test
    @DisplayName("워크스페이스를 생성한다")
    void create_Success() throws Exception {
        // given
        Long orgId = 1L;
        Long userId = 1L;
        WorkspaceCreateRequest request = new WorkspaceCreateRequest("production", "프로덕션 환경");

        User mockUser = createMockUser(userId);
        Organization mockOrg = createMockOrganization(orgId, mockUser);

        given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
        given(organizationRepository.findByIdAndStatus(orgId, OrganizationStatus.ACTIVE))
            .willReturn(Optional.of(mockOrg));
        given(organizationMemberRepository.existsByOrganizationAndUser(mockOrg, mockUser))
            .willReturn(true);
        given(workspaceRepository.existsByOrganizationAndName(mockOrg, "production"))
            .willReturn(false);
        given(workspaceRepository.save(any(Workspace.class))).willAnswer(invocation -> {
            Workspace ws = invocation.getArgument(0);
            setId(ws, 1L);
            return ws;
        });

        // when
        WorkspaceCreateResponse response = workspaceService.create(orgId, userId, request);

        // then
        assertThat(response.id()).isEqualTo(1L);
        assertThat(response.name()).isEqualTo("production");
        assertThat(response.displayName()).isEqualTo("프로덕션 환경");
        assertThat(response.status()).isEqualTo(WorkspaceStatus.ACTIVE);

        verify(workspaceRepository).save(any(Workspace.class));
        verify(workspaceMemberRepository).save(argThat(member ->
            member.getRole() == WorkspaceRole.OWNER &&
            member.getUser().equals(mockUser)
        ));
    }

    @Test
    @DisplayName("워크스페이스 생성시 생성자가 OWNER로 추가된다")
    void create_CreatorBecomesOwner() throws Exception {
        // given
        Long orgId = 1L;
        Long userId = 1L;
        WorkspaceCreateRequest request = new WorkspaceCreateRequest("dev", "개발 환경");

        User mockUser = createMockUser(userId);
        Organization mockOrg = createMockOrganization(orgId, mockUser);

        given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
        given(organizationRepository.findByIdAndStatus(orgId, OrganizationStatus.ACTIVE))
            .willReturn(Optional.of(mockOrg));
        given(organizationMemberRepository.existsByOrganizationAndUser(mockOrg, mockUser))
            .willReturn(true);
        given(workspaceRepository.existsByOrganizationAndName(mockOrg, "dev"))
            .willReturn(false);
        given(workspaceRepository.save(any(Workspace.class))).willAnswer(invocation -> {
            Workspace ws = invocation.getArgument(0);
            setId(ws, 1L);
            return ws;
        });

        // when
        workspaceService.create(orgId, userId, request);

        // then
        verify(workspaceMemberRepository).save(argThat(member ->
            member.getRole() == WorkspaceRole.OWNER
        ));
    }

    @Test
    @DisplayName("존재하지 않는 사용자로 워크스페이스 생성 시 예외가 발생한다")
    void create_UserNotFound_ThrowsException() {
        // given
        Long orgId = 1L;
        Long userId = 999L;
        WorkspaceCreateRequest request = new WorkspaceCreateRequest("production", "프로덕션");

        given(userRepository.findById(userId)).willReturn(Optional.empty());

        // when & then
        assertThatThrownBy(() -> workspaceService.create(orgId, userId, request))
            .isInstanceOf(BusinessException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);

        verify(workspaceRepository, never()).save(any());
    }

    @Test
    @DisplayName("존재하지 않는 조직에 워크스페이스 생성 시 예외가 발생한다")
    void create_OrganizationNotFound_ThrowsException() throws Exception {
        // given
        Long orgId = 999L;
        Long userId = 1L;
        WorkspaceCreateRequest request = new WorkspaceCreateRequest("production", "프로덕션");

        User mockUser = createMockUser(userId);

        given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
        given(organizationRepository.findByIdAndStatus(orgId, OrganizationStatus.ACTIVE))
            .willReturn(Optional.empty());

        // when & then
        assertThatThrownBy(() -> workspaceService.create(orgId, userId, request))
            .isInstanceOf(BusinessException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);

        verify(workspaceRepository, never()).save(any());
    }

    @Test
    @DisplayName("조직 멤버가 아닌 사용자가 워크스페이스 생성 시 예외가 발생한다")
    void create_NotOrganizationMember_ThrowsException() throws Exception {
        // given
        Long orgId = 1L;
        Long userId = 1L;
        WorkspaceCreateRequest request = new WorkspaceCreateRequest("production", "프로덕션");

        User mockUser = createMockUser(userId);
        Organization mockOrg = createMockOrganization(orgId, mockUser);

        given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
        given(organizationRepository.findByIdAndStatus(orgId, OrganizationStatus.ACTIVE))
            .willReturn(Optional.of(mockOrg));
        given(organizationMemberRepository.existsByOrganizationAndUser(mockOrg, mockUser))
            .willReturn(false);

        // when & then
        assertThatThrownBy(() -> workspaceService.create(orgId, userId, request))
            .isInstanceOf(BusinessException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);

        verify(workspaceRepository, never()).save(any());
    }

    @Test
    @DisplayName("조직 내 워크스페이스 이름 중복 시 예외가 발생한다")
    void create_DuplicateName_ThrowsException() throws Exception {
        // given
        Long orgId = 1L;
        Long userId = 1L;
        WorkspaceCreateRequest request = new WorkspaceCreateRequest("production", "프로덕션");

        User mockUser = createMockUser(userId);
        Organization mockOrg = createMockOrganization(orgId, mockUser);

        given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
        given(organizationRepository.findByIdAndStatus(orgId, OrganizationStatus.ACTIVE))
            .willReturn(Optional.of(mockOrg));
        given(organizationMemberRepository.existsByOrganizationAndUser(mockOrg, mockUser))
            .willReturn(true);
        given(workspaceRepository.existsByOrganizationAndName(mockOrg, "production"))
            .willReturn(true);

        // when & then
        assertThatThrownBy(() -> workspaceService.create(orgId, userId, request))
            .isInstanceOf(BusinessException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CONFLICT);

        verify(workspaceRepository, never()).save(any());
    }

    private User createMockUser(Long id) throws Exception {
        User user = User.create("test@example.com", "encodedPassword", "테스트 유저");
        setId(user, id);
        return user;
    }

    private Organization createMockOrganization(Long id, User creator) throws Exception {
        Organization org = Organization.create("테스트 조직", creator);
        setId(org, id);
        return org;
    }

    private void setId(Object entity, Long id) throws Exception {
        var idField = entity.getClass().getDeclaredField("id");
        idField.setAccessible(true);
        idField.set(entity, id);
    }
}
