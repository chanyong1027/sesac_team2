package com.llm_ops.demo.organization;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.organization.domain.Organization;
import com.llm_ops.demo.organization.domain.OrganizationMember;
import com.llm_ops.demo.organization.domain.OrganizationRole;
import com.llm_ops.demo.organization.dto.OrganizationMemberRemoveResponse;
import com.llm_ops.demo.organization.repository.OrganizationMemberRepository;
import com.llm_ops.demo.organization.repository.OrganizationRepository;
import com.llm_ops.demo.organization.service.OrganizationMemberService;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.domain.WorkspaceMember;
import com.llm_ops.demo.workspace.domain.WorkspaceRole;
import com.llm_ops.demo.workspace.repository.WorkspaceMemberRepository;
import com.llm_ops.demo.workspace.repository.WorkspaceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class OrganizationMemberIntegrationTest {

    @Autowired
    private OrganizationMemberService organizationMemberService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private OrganizationMemberRepository organizationMemberRepository;

    @Autowired
    private WorkspaceRepository workspaceRepository;

    @Autowired
    private WorkspaceMemberRepository workspaceMemberRepository;

    private User ownerUser;
    private User adminUser;
    private User memberUser;
    private Organization organization;
    private Workspace workspace;

    @BeforeEach
    void setUp() {
        ownerUser = userRepository.save(User.create("owner@test.com", "password123!", "Owner"));
        adminUser = userRepository.save(User.create("admin@test.com", "password123!", "Admin"));
        memberUser = userRepository.save(User.create("member@test.com", "password123!", "Member"));

        organization = organizationRepository.save(Organization.create("Test Org", ownerUser));

        organizationMemberRepository.save(OrganizationMember.create(organization, ownerUser, OrganizationRole.OWNER));
        organizationMemberRepository.save(OrganizationMember.create(organization, adminUser, OrganizationRole.ADMIN));
        organizationMemberRepository.save(OrganizationMember.create(organization, memberUser, OrganizationRole.MEMBER));

        workspace = workspaceRepository.save(Workspace.create(organization, "test-workspace", "Test Workspace"));
        workspaceMemberRepository.save(WorkspaceMember.create(workspace, ownerUser, WorkspaceRole.OWNER));
        workspaceMemberRepository.save(WorkspaceMember.create(workspace, adminUser, WorkspaceRole.MEMBER));
        workspaceMemberRepository.save(WorkspaceMember.create(workspace, memberUser, WorkspaceRole.MEMBER));
    }

    @Test
    @DisplayName("OWNER가 MEMBER를 퇴출하면 조직과 워크스페이스에서 모두 삭제된다")
    void removeMember_ByOwner_RemovesFromOrgAndWorkspace() {
        // given
        OrganizationMember targetMember = organizationMemberRepository
            .findByOrganizationAndUser(organization, memberUser)
            .orElseThrow();

        // when
        OrganizationMemberRemoveResponse response = organizationMemberService.removeMember(
            organization.getId(),
            targetMember.getId(),
            ownerUser.getId()
        );

        // then
        assertThat(response.memberId()).isEqualTo(targetMember.getId());

        // 조직 멤버십 삭제 확인
        boolean orgMemberExists = organizationMemberRepository
            .existsByOrganizationAndUser(organization, memberUser);
        assertThat(orgMemberExists).isFalse();

        // 워크스페이스 멤버십 삭제 확인
        boolean workspaceMemberExists = workspaceMemberRepository
            .existsByWorkspaceAndUser(workspace, memberUser);
        assertThat(workspaceMemberExists).isFalse();
    }

    @Test
    @DisplayName("ADMIN이 MEMBER를 퇴출할 수 있다")
    void removeMember_ByAdmin_Success() {
        // given
        OrganizationMember targetMember = organizationMemberRepository
            .findByOrganizationAndUser(organization, memberUser)
            .orElseThrow();

        // when
        OrganizationMemberRemoveResponse response = organizationMemberService.removeMember(
            organization.getId(),
            targetMember.getId(),
            adminUser.getId()
        );

        // then
        assertThat(response.memberId()).isEqualTo(targetMember.getId());

        boolean orgMemberExists = organizationMemberRepository
            .existsByOrganizationAndUser(organization, memberUser);
        assertThat(orgMemberExists).isFalse();
    }

    @Test
    @DisplayName("MEMBER 역할은 다른 멤버를 퇴출할 수 없다 - FORBIDDEN")
    void removeMember_ByMember_ThrowsForbidden() {
        // given
        User anotherMember = userRepository.save(User.create("another@test.com", "password123!", "Another"));
        organizationMemberRepository.save(OrganizationMember.create(organization, anotherMember, OrganizationRole.MEMBER));

        OrganizationMember targetMember = organizationMemberRepository
            .findByOrganizationAndUser(organization, anotherMember)
            .orElseThrow();

        // when & then
        assertThatThrownBy(() -> organizationMemberService.removeMember(
            organization.getId(),
            targetMember.getId(),
            memberUser.getId()
        ))
            .isInstanceOf(BusinessException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);

        // 멤버가 여전히 존재하는지 확인
        boolean orgMemberExists = organizationMemberRepository
            .existsByOrganizationAndUser(organization, anotherMember);
        assertThat(orgMemberExists).isTrue();
    }

    @Test
    @DisplayName("OWNER는 퇴출할 수 없다")
    void removeMember_OwnerTarget_ThrowsInvalidInput() {
        // given
        OrganizationMember ownerMember = organizationMemberRepository
            .findByOrganizationAndUser(organization, ownerUser)
            .orElseThrow();

        // when & then
        assertThatThrownBy(() -> organizationMemberService.removeMember(
            organization.getId(),
            ownerMember.getId(),
            adminUser.getId()
        ))
            .isInstanceOf(BusinessException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_INPUT_VALUE)
            .hasMessageContaining("OWNER는 퇴출할 수 없습니다");
    }

    @Test
    @DisplayName("본인은 퇴출할 수 없다")
    void removeMember_Self_ThrowsInvalidInput() {
        // given
        OrganizationMember adminMember = organizationMemberRepository
            .findByOrganizationAndUser(organization, adminUser)
            .orElseThrow();

        // when & then
        assertThatThrownBy(() -> organizationMemberService.removeMember(
            organization.getId(),
            adminMember.getId(),
            adminUser.getId()
        ))
            .isInstanceOf(BusinessException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_INPUT_VALUE)
            .hasMessageContaining("본인은 퇴출할 수 없습니다");
    }
}
