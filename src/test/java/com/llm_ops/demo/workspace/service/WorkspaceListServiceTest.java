package com.llm_ops.demo.workspace.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.organization.domain.Organization;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.domain.WorkspaceMember;
import com.llm_ops.demo.workspace.domain.WorkspaceRole;
import com.llm_ops.demo.workspace.dto.WorkspaceSummaryResponse;
import com.llm_ops.demo.workspace.repository.WorkspaceMemberRepository;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class WorkspaceListServiceTest {

    @InjectMocks
    private WorkspaceListService workspaceListService;

    @Mock
    private WorkspaceMemberRepository workspaceMemberRepository;

    @Mock
    private UserRepository userRepository;

    @Test
    @DisplayName("사용자가 속한 워크스페이스 목록을 조회한다")
    void getMyWorkspaces_Success() throws Exception {
        // given
        Long userId = 1L;
        User mockUser = createMockUser(userId);
        Organization mockOrg = createMockOrganization(1L, mockUser);
        Workspace mockWorkspace1 = createMockWorkspace(1L, mockOrg, "production", "프로덕션");
        Workspace mockWorkspace2 = createMockWorkspace(2L, mockOrg, "staging", "스테이징");
        WorkspaceMember member1 = WorkspaceMember.create(mockWorkspace1, mockUser, WorkspaceRole.OWNER);
        WorkspaceMember member2 = WorkspaceMember.create(mockWorkspace2, mockUser, WorkspaceRole.MEMBER);

        given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
        given(workspaceMemberRepository.findByUserWithWorkspaceAndOrganization(mockUser))
            .willReturn(List.of(member1, member2));

        // when
        List<WorkspaceSummaryResponse> result = workspaceListService.getMyWorkspaces(userId);

        // then
        assertThat(result).hasSize(2);
        assertThat(result.get(0).name()).isEqualTo("production");
        assertThat(result.get(0).myRole()).isEqualTo(WorkspaceRole.OWNER);
        assertThat(result.get(1).name()).isEqualTo("staging");
        assertThat(result.get(1).myRole()).isEqualTo(WorkspaceRole.MEMBER);
    }

    @Test
    @DisplayName("워크스페이스가 없는 사용자는 빈 리스트를 반환한다")
    void getMyWorkspaces_NoWorkspaces_ReturnsEmptyList() throws Exception {
        // given
        Long userId = 1L;
        User mockUser = createMockUser(userId);

        given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
        given(workspaceMemberRepository.findByUserWithWorkspaceAndOrganization(mockUser))
            .willReturn(Collections.emptyList());

        // when
        List<WorkspaceSummaryResponse> result = workspaceListService.getMyWorkspaces(userId);

        // then
        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("존재하지 않는 사용자로 조회 시 예외가 발생한다")
    void getMyWorkspaces_UserNotFound_ThrowsException() {
        // given
        Long userId = 999L;

        given(userRepository.findById(userId)).willReturn(Optional.empty());

        // when & then
        assertThatThrownBy(() -> workspaceListService.getMyWorkspaces(userId))
            .isInstanceOf(BusinessException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
    }

    @Test
    @DisplayName("조직 정보가 올바르게 포함된다")
    void getMyWorkspaces_IncludesOrganizationInfo() throws Exception {
        // given
        Long userId = 1L;
        User mockUser = createMockUser(userId);
        Organization mockOrg = createMockOrganization(1L, mockUser);
        Workspace mockWorkspace = createMockWorkspace(1L, mockOrg, "production", "프로덕션");
        WorkspaceMember member = WorkspaceMember.create(mockWorkspace, mockUser, WorkspaceRole.OWNER);

        given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
        given(workspaceMemberRepository.findByUserWithWorkspaceAndOrganization(mockUser))
            .willReturn(List.of(member));

        // when
        List<WorkspaceSummaryResponse> result = workspaceListService.getMyWorkspaces(userId);

        // then
        assertThat(result).hasSize(1);
        assertThat(result.get(0).organizationId()).isEqualTo(1L);
        assertThat(result.get(0).organizationName()).isEqualTo("테스트 조직");
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

    private Workspace createMockWorkspace(Long id, Organization org, String name, String displayName) throws Exception {
        Workspace workspace = Workspace.create(org, name, displayName);
        setId(workspace, id);
        return workspace;
    }

    private void setId(Object entity, Long id) throws Exception {
        var idField = entity.getClass().getDeclaredField("id");
        idField.setAccessible(true);
        idField.set(entity, id);
    }
}
