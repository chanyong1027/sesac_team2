package com.llm_ops.demo.organization.service;

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
import com.llm_ops.demo.organization.domain.OrganizationRole;
import com.llm_ops.demo.organization.domain.OrganizationStatus;
import com.llm_ops.demo.organization.dto.OrganizationMemberRemoveResponse;
import com.llm_ops.demo.organization.dto.OrganizationMemberResponse;
import com.llm_ops.demo.organization.repository.OrganizationMemberRepository;
import com.llm_ops.demo.organization.repository.OrganizationRepository;
import com.llm_ops.demo.workspace.repository.WorkspaceMemberRepository;
import java.lang.reflect.Field;
import java.util.List;
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
class OrganizationMemberServiceTest {

    @InjectMocks
    private OrganizationMemberService organizationMemberService;

    @Mock
    private OrganizationMemberRepository organizationMemberRepository;

    @Mock
    private OrganizationRepository organizationRepository;

    @Mock
    private WorkspaceMemberRepository workspaceMemberRepository;

    @Mock
    private UserRepository userRepository;

    private User ownerUser;
    private User adminUser;
    private User memberUser;
    private User targetUser;
    private Organization organization;
    private OrganizationMember ownerMember;
    private OrganizationMember adminMember;
    private OrganizationMember targetMember;

    @BeforeEach
    void setUp() throws Exception {
        ownerUser = createUser(1L, "owner@example.com", "오너");
        adminUser = createUser(2L, "admin@example.com", "관리자");
        memberUser = createUser(3L, "member@example.com", "멤버");
        targetUser = createUser(4L, "target@example.com", "대상자");

        organization = createOrganization(1L, "테스트조직", ownerUser);

        ownerMember = createOrganizationMember(1L, organization, ownerUser, OrganizationRole.OWNER);
        adminMember = createOrganizationMember(2L, organization, adminUser, OrganizationRole.ADMIN);
        targetMember = createOrganizationMember(4L, organization, targetUser, OrganizationRole.MEMBER);
    }

    @Nested
    @DisplayName("멤버 목록 조회")
    class GetMembers {

        @Test
        @DisplayName("조직 멤버 목록을 조회한다")
        void getMembers_Success() {
            // given
            Long organizationId = 1L;
            Long userId = 1L;

            given(userRepository.findById(userId)).willReturn(Optional.of(ownerUser));
            given(organizationRepository.findByIdAndStatus(organizationId, OrganizationStatus.ACTIVE))
                .willReturn(Optional.of(organization));
            given(organizationMemberRepository.existsByOrganizationAndUser(organization, ownerUser))
                .willReturn(true);
            given(organizationMemberRepository.findByOrganizationWithUser(organization))
                .willReturn(List.of(ownerMember, adminMember, targetMember));

            // when
            List<OrganizationMemberResponse> result = organizationMemberService.getMembers(organizationId, userId);

            // then
            assertThat(result).hasSize(3);
            verify(organizationMemberRepository).findByOrganizationWithUser(organization);
        }

        @Test
        @DisplayName("존재하지 않는 조직 조회 시 예외가 발생한다")
        void getMembers_OrganizationNotFound_ThrowsException() {
            // given
            Long organizationId = 999L;
            Long userId = 1L;

            given(userRepository.findById(userId)).willReturn(Optional.of(ownerUser));
            given(organizationRepository.findByIdAndStatus(organizationId, OrganizationStatus.ACTIVE))
                .willReturn(Optional.empty());

            // when & then
            assertThatThrownBy(() -> organizationMemberService.getMembers(organizationId, userId))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
        }

        @Test
        @DisplayName("조직 멤버가 아닌 사용자 조회 시 예외가 발생한다")
        void getMembers_NotMember_ThrowsException() {
            // given
            Long organizationId = 1L;
            Long userId = 99L;
            User outsider = createUser(99L, "outsider@example.com", "외부인");

            given(userRepository.findById(userId)).willReturn(Optional.of(outsider));
            given(organizationRepository.findByIdAndStatus(organizationId, OrganizationStatus.ACTIVE))
                .willReturn(Optional.of(organization));
            given(organizationMemberRepository.existsByOrganizationAndUser(organization, outsider))
                .willReturn(false);

            // when & then
            assertThatThrownBy(() -> organizationMemberService.getMembers(organizationId, userId))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);
        }
    }

    @Nested
    @DisplayName("멤버 퇴출")
    class RemoveMember {

        @Test
        @DisplayName("OWNER가 멤버를 퇴출한다")
        void removeMember_ByOwner_Success() {
            // given
            Long organizationId = 1L;
            Long memberId = 4L;
            Long userId = 1L;

            given(userRepository.findById(userId)).willReturn(Optional.of(ownerUser));
            given(organizationRepository.findByIdAndStatus(organizationId, OrganizationStatus.ACTIVE))
                .willReturn(Optional.of(organization));
            given(organizationMemberRepository.findByOrganizationAndUser(organization, ownerUser))
                .willReturn(Optional.of(ownerMember));
            given(organizationMemberRepository.findById(memberId))
                .willReturn(Optional.of(targetMember));

            // when
            OrganizationMemberRemoveResponse result = organizationMemberService.removeMember(organizationId, memberId, userId);

            // then
            assertThat(result.memberId()).isEqualTo(memberId);
            assertThat(result.removedAt()).isNotNull();
            verify(workspaceMemberRepository).deleteByUserAndOrganization(targetUser, organization);
            verify(organizationMemberRepository).delete(targetMember);
        }

        @Test
        @DisplayName("ADMIN이 멤버를 퇴출한다")
        void removeMember_ByAdmin_Success() {
            // given
            Long organizationId = 1L;
            Long memberId = 4L;
            Long userId = 2L;

            given(userRepository.findById(userId)).willReturn(Optional.of(adminUser));
            given(organizationRepository.findByIdAndStatus(organizationId, OrganizationStatus.ACTIVE))
                .willReturn(Optional.of(organization));
            given(organizationMemberRepository.findByOrganizationAndUser(organization, adminUser))
                .willReturn(Optional.of(adminMember));
            given(organizationMemberRepository.findById(memberId))
                .willReturn(Optional.of(targetMember));

            // when
            OrganizationMemberRemoveResponse result = organizationMemberService.removeMember(organizationId, memberId, userId);

            // then
            assertThat(result.memberId()).isEqualTo(memberId);
            verify(organizationMemberRepository).delete(targetMember);
        }

        @Test
        @DisplayName("MEMBER 역할은 퇴출 권한이 없어 예외가 발생한다")
        void removeMember_ByMember_ThrowsException() throws Exception {
            // given
            Long organizationId = 1L;
            Long memberId = 4L;
            Long userId = 3L;
            OrganizationMember memberRoleMember = createOrganizationMember(3L, organization, memberUser, OrganizationRole.MEMBER);

            given(userRepository.findById(userId)).willReturn(Optional.of(memberUser));
            given(organizationRepository.findByIdAndStatus(organizationId, OrganizationStatus.ACTIVE))
                .willReturn(Optional.of(organization));
            given(organizationMemberRepository.findByOrganizationAndUser(organization, memberUser))
                .willReturn(Optional.of(memberRoleMember));

            // when & then
            assertThatThrownBy(() -> organizationMemberService.removeMember(organizationId, memberId, userId))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);

            verify(organizationMemberRepository, never()).delete(any());
        }

        @Test
        @DisplayName("OWNER는 퇴출할 수 없어 예외가 발생한다")
        void removeMember_OwnerTarget_ThrowsException() {
            // given
            Long organizationId = 1L;
            Long memberId = 1L;
            Long userId = 2L;

            given(userRepository.findById(userId)).willReturn(Optional.of(adminUser));
            given(organizationRepository.findByIdAndStatus(organizationId, OrganizationStatus.ACTIVE))
                .willReturn(Optional.of(organization));
            given(organizationMemberRepository.findByOrganizationAndUser(organization, adminUser))
                .willReturn(Optional.of(adminMember));
            given(organizationMemberRepository.findById(memberId))
                .willReturn(Optional.of(ownerMember));

            // when & then
            assertThatThrownBy(() -> organizationMemberService.removeMember(organizationId, memberId, userId))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_INPUT_VALUE);

            verify(organizationMemberRepository, never()).delete(any());
        }

        @Test
        @DisplayName("본인은 퇴출할 수 없어 예외가 발생한다")
        void removeMember_Self_ThrowsException() {
            // given
            Long organizationId = 1L;
            Long memberId = 2L;
            Long userId = 2L;

            given(userRepository.findById(userId)).willReturn(Optional.of(adminUser));
            given(organizationRepository.findByIdAndStatus(organizationId, OrganizationStatus.ACTIVE))
                .willReturn(Optional.of(organization));
            given(organizationMemberRepository.findByOrganizationAndUser(organization, adminUser))
                .willReturn(Optional.of(adminMember));
            given(organizationMemberRepository.findById(memberId))
                .willReturn(Optional.of(adminMember));

            // when & then
            assertThatThrownBy(() -> organizationMemberService.removeMember(organizationId, memberId, userId))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_INPUT_VALUE);

            verify(organizationMemberRepository, never()).delete(any());
        }

        @Test
        @DisplayName("존재하지 않는 멤버 퇴출 시 예외가 발생한다")
        void removeMember_MemberNotFound_ThrowsException() {
            // given
            Long organizationId = 1L;
            Long memberId = 999L;
            Long userId = 1L;

            given(userRepository.findById(userId)).willReturn(Optional.of(ownerUser));
            given(organizationRepository.findByIdAndStatus(organizationId, OrganizationStatus.ACTIVE))
                .willReturn(Optional.of(organization));
            given(organizationMemberRepository.findByOrganizationAndUser(organization, ownerUser))
                .willReturn(Optional.of(ownerMember));
            given(organizationMemberRepository.findById(memberId))
                .willReturn(Optional.empty());

            // when & then
            assertThatThrownBy(() -> organizationMemberService.removeMember(organizationId, memberId, userId))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);

            verify(organizationMemberRepository, never()).delete(any());
        }

        @Test
        @DisplayName("다른 조직 멤버 퇴출 시 예외가 발생한다")
        void removeMember_DifferentOrganization_ThrowsException() throws Exception {
            // given
            Long organizationId = 1L;
            Long memberId = 10L;
            Long userId = 1L;

            Organization otherOrganization = createOrganization(2L, "다른조직", ownerUser);
            OrganizationMember otherOrgMember = createOrganizationMember(10L, otherOrganization, targetUser, OrganizationRole.MEMBER);

            given(userRepository.findById(userId)).willReturn(Optional.of(ownerUser));
            given(organizationRepository.findByIdAndStatus(organizationId, OrganizationStatus.ACTIVE))
                .willReturn(Optional.of(organization));
            given(organizationMemberRepository.findByOrganizationAndUser(organization, ownerUser))
                .willReturn(Optional.of(ownerMember));
            given(organizationMemberRepository.findById(memberId))
                .willReturn(Optional.of(otherOrgMember));

            // when & then
            assertThatThrownBy(() -> organizationMemberService.removeMember(organizationId, memberId, userId))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);

            verify(organizationMemberRepository, never()).delete(any());
        }
    }

    // ========== Helper Methods ==========

    private User createUser(Long id, String email, String name) {
        User user = User.create(email, "password123!", name);
        setField(user, "id", id);
        return user;
    }

    private Organization createOrganization(Long id, String name, User creator) {
        Organization org = Organization.create(name, creator);
        setField(org, "id", id);
        return org;
    }

    private OrganizationMember createOrganizationMember(Long id, Organization organization, User user, OrganizationRole role) {
        OrganizationMember member = OrganizationMember.create(organization, user, role);
        setField(member, "id", id);
        return member;
    }

    private void setField(Object target, String fieldName, Object value) {
        try {
            Field field = findField(target.getClass(), fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
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
