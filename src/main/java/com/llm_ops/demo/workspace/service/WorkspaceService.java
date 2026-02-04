package com.llm_ops.demo.workspace.service;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.organization.domain.Organization;
import com.llm_ops.demo.organization.domain.OrganizationMember;
import com.llm_ops.demo.organization.domain.OrganizationStatus;
import com.llm_ops.demo.organization.repository.OrganizationMemberRepository;
import com.llm_ops.demo.organization.repository.OrganizationRepository;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.domain.WorkspaceMember;
import com.llm_ops.demo.workspace.domain.WorkspaceRole;
import com.llm_ops.demo.workspace.domain.WorkspaceStatus;
import com.llm_ops.demo.workspace.dto.WorkspaceCreateRequest;
import com.llm_ops.demo.workspace.dto.WorkspaceCreateResponse;
import com.llm_ops.demo.workspace.dto.WorkspaceUpdateRequest;
import com.llm_ops.demo.workspace.dto.WorkspaceUpdateResponse;
import com.llm_ops.demo.workspace.repository.WorkspaceMemberRepository;
import com.llm_ops.demo.workspace.repository.WorkspaceRepository;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WorkspaceService {

    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final OrganizationRepository organizationRepository;
    private final OrganizationMemberRepository organizationMemberRepository;
    private final UserRepository userRepository;

    @Transactional
    public WorkspaceCreateResponse create(Long orgId, Long userId, WorkspaceCreateRequest request) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        Organization organization = organizationRepository.findByIdAndStatus(orgId, OrganizationStatus.ACTIVE)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        validateOrganizationMembership(organization, user);
        validateDuplicateName(organization, request.name());

        Workspace workspace = Workspace.create(organization, request.name(), request.displayName());
        Workspace saved = workspaceRepository.save(workspace);

        WorkspaceMember ownerMember = WorkspaceMember.create(saved, user, WorkspaceRole.OWNER);
        workspaceMemberRepository.save(ownerMember);

        return WorkspaceCreateResponse.from(saved);
    }

    @Transactional
    public WorkspaceUpdateResponse update(Long orgId, Long workspaceId, Long userId, WorkspaceUpdateRequest request) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        Organization organization = organizationRepository.findByIdAndStatus(orgId, OrganizationStatus.ACTIVE)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        Workspace workspace = workspaceRepository.findByIdAndOrganizationIdAndStatus(workspaceId, orgId, WorkspaceStatus.ACTIVE)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        validateUpdatePermission(workspace, organization, user);

        workspace.updateDisplayName(request.displayName());
        return WorkspaceUpdateResponse.from(workspace);
    }

    private void validateUpdatePermission(Workspace workspace, Organization organization, User user) {
        Optional<WorkspaceMember> workspaceMember = workspaceMemberRepository.findByWorkspaceAndUser(workspace, user);
        if (workspaceMember.isPresent() && workspaceMember.get().isOwner()) {
            return;
        }

        Optional<OrganizationMember> orgMember = organizationMemberRepository.findByOrganizationAndUser(organization, user);
        if (orgMember.isPresent() && orgMember.get().canManageMembers()) {
            return;
        }

        throw new BusinessException(ErrorCode.FORBIDDEN);
    }

    private void validateOrganizationMembership(Organization organization, User user) {
        boolean isMember = organizationMemberRepository.existsByOrganizationAndUser(organization, user);
        if (!isMember) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
    }

    private void validateDuplicateName(Organization organization, String name) {
        if (workspaceRepository.existsByOrganizationAndName(organization, name)) {
            throw new BusinessException(ErrorCode.CONFLICT);
        }
    }
}
