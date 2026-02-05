package com.llm_ops.demo.organization.service;

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
import com.llm_ops.demo.organization.dto.OrganizationMemberRoleUpdateRequest;
import com.llm_ops.demo.organization.dto.OrganizationMemberRoleUpdateResponse;
import com.llm_ops.demo.organization.repository.OrganizationMemberRepository;
import com.llm_ops.demo.organization.repository.OrganizationRepository;
import com.llm_ops.demo.workspace.repository.WorkspaceMemberRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OrganizationMemberService {

    private final OrganizationMemberRepository organizationMemberRepository;
    private final OrganizationRepository organizationRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final UserRepository userRepository;

    public List<OrganizationMemberResponse> getMembers(Long organizationId, Long userId) {
        User user = findUserById(userId);
        Organization organization = findActiveOrganizationById(organizationId);

        validateMembership(organization, user);

        return findMembersWithUser(organization).stream()
            .map(OrganizationMemberResponse::from)
            .toList();
    }

    @Transactional
    public OrganizationMemberRemoveResponse removeMember(
        Long organizationId,
        Long memberId,
        Long userId
    ) {
        User user = findUserById(userId);
        Organization organization = findActiveOrganizationById(organizationId);

        validateManagePermission(organization, user);

        OrganizationMember targetMember = findMemberById(memberId);

        validateSameOrganization(targetMember, organization);
        validateNotOwner(targetMember);
        validateNotSelf(targetMember, user);

        deleteWorkspaceMemberships(targetMember.getUser(), organization);
        deleteOrganizationMember(targetMember);

        return OrganizationMemberRemoveResponse.of(memberId);
    }

    @Transactional
    public OrganizationMemberRoleUpdateResponse updateMemberRole(
            Long organizationId,
            Long memberId,
            Long userId,
            OrganizationMemberRoleUpdateRequest request
    ) {
        User user = findUserById(userId);
        Organization organization = findActiveOrganizationById(organizationId);
        validateOwnerPermission(organization, user);  // OWNER만 가능
        OrganizationMember targetMember = findMemberById(memberId);
        validateSameOrganization(targetMember, organization);
        validateNotOwner(targetMember);  // OWNER 역할 변경 불가
        validateNotSelf(targetMember, user);  // 본인 역할 변경 불가
        validateNotToOwner(request.role());  // OWNER로 변경 불가
        OrganizationRole previousRole = targetMember.getRole();
        targetMember.changeRole(request.role());
        return OrganizationMemberRoleUpdateResponse.from(memberId, previousRole, request.role());
    }

    private User findUserById(Long userId) {
        return userRepository.findById(userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    private Organization findActiveOrganizationById(Long organizationId) {
        return organizationRepository.findByIdAndStatus(organizationId, OrganizationStatus.ACTIVE)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    private void validateMembership(Organization organization, User user) {
        boolean isMember = organizationMemberRepository.existsByOrganizationAndUser(organization, user);
        if (!isMember) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
    }

    private void validateManagePermission(Organization organization, User user) {
        OrganizationMember member = organizationMemberRepository.findByOrganizationAndUser(organization, user)
            .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));

        if (!member.canManageMembers()) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
    }

    private OrganizationMember findMemberById(Long memberId) {
        return organizationMemberRepository.findById(memberId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    private void validateSameOrganization(OrganizationMember targetMember, Organization organization) {
        if (!targetMember.getOrganization().getId().equals(organization.getId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
    }

    private void validateNotOwner(OrganizationMember targetMember) {
        if (targetMember.isOwner()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "OWNER는 퇴출할 수 없습니다.");
        }
    }

    private void validateNotSelf(OrganizationMember targetMember, User user) {
        if (targetMember.getUser().getId().equals(user.getId())) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "본인은 퇴출할 수 없습니다.");
        }
    }

    private List<OrganizationMember> findMembersWithUser(Organization organization) {
        return organizationMemberRepository.findByOrganizationWithUser(organization);
    }

    private void deleteWorkspaceMemberships(User user, Organization organization) {
        workspaceMemberRepository.deleteByUserAndOrganization(user, organization);
    }

    private void deleteOrganizationMember(OrganizationMember member) {
        //혹시 에러 나면 deleteById로 변경
        organizationMemberRepository.delete(member);
    }

    private void validateOwnerPermission(Organization organization, User user) {
        OrganizationMember member = organizationMemberRepository
                .findByOrganizationAndUser(organization, user)
                .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
        if (!member.isOwner()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "OWNER만 역할을 변경할 수 있습니다.");
        }
    }
    private void validateNotToOwner(OrganizationRole newRole) {
        if (newRole == OrganizationRole.OWNER) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "OWNER 역할로 변경할 수 없습니다.");
        }
    }
}
