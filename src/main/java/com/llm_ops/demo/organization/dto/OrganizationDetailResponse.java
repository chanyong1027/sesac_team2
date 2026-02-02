package com.llm_ops.demo.organization.dto;

import com.llm_ops.demo.organization.domain.Organization;
import com.llm_ops.demo.organization.domain.OrganizationStatus;
import java.time.LocalDateTime;

public record OrganizationDetailResponse(
    Long id,
    String name,
    OrganizationStatus status,
    LocalDateTime createdAt
) {
    public static OrganizationDetailResponse from(Organization organization) {
        return new OrganizationDetailResponse(
            organization.getId(),
            organization.getName(),
            organization.getStatus(),
            organization.getCreatedAt()
        );
    }
}
