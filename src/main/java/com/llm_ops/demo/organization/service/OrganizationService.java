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

    @Transactional
    public OrganizationCreateResponse create(Long userId, OrganizationCreateRequest request) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

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
