package com.llm_ops.demo.organization.service;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.organization.domain.Organization;
import com.llm_ops.demo.organization.domain.OrganizationMember;
import com.llm_ops.demo.organization.domain.OrganizationRole;
import com.llm_ops.demo.organization.domain.OrganizationStatus;
import com.llm_ops.demo.organization.dto.OrganizationCreateRequest;
import com.llm_ops.demo.organization.dto.OrganizationCreateResponse;
import com.llm_ops.demo.organization.dto.OrganizationDetailResponse;
import com.llm_ops.demo.organization.repository.OrganizationMemberRepository;
import com.llm_ops.demo.organization.repository.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class OrganizationService {

    private final OrganizationRepository organizationRepository;
    private final OrganizationMemberRepository organizationMemberRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public OrganizationDetailResponse getDetail(Long organizationId, Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "사용자를 찾을 수 없습니다."));

        Organization organization = organizationRepository.findByIdAndStatus(organizationId, OrganizationStatus.ACTIVE)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "조직을 찾을 수 없습니다."));

        if (!organizationMemberRepository.existsByOrganizationAndUser(organization, user)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "조직 접근 권한이 없습니다.");
        }

        return OrganizationDetailResponse.from(organization);
    }

    @Transactional
    public OrganizationCreateResponse create(Long userId, OrganizationCreateRequest request) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        if (!organizationMemberRepository.findByUser(user).isEmpty()) {
            throw new BusinessException(ErrorCode.CONFLICT, "이미 조직에 속해 있습니다.");
        }

        validateDuplicateName(user, request.name());

        Organization organization = Organization.create(request.name(), user);
        try {
            Organization saved = organizationRepository.save(organization);

            OrganizationMember ownerMember = OrganizationMember.create(
                    saved,
                    user,
                    OrganizationRole.OWNER
            );
            organizationMemberRepository.save(ownerMember);
            return OrganizationCreateResponse.from(saved);
        }catch (DataIntegrityViolationException e) {
            throw new BusinessException(ErrorCode.CONFLICT);
        }
    }

    private void validateDuplicateName(User user, String name) {
        if (organizationRepository.existsByCreatedByAndNameAndStatus(user, name, OrganizationStatus.ACTIVE)) {
            throw new BusinessException(ErrorCode.CONFLICT);
        }
    }
}
