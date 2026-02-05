package com.llm_ops.demo.organization.dto;

import com.llm_ops.demo.organization.domain.Organization;
import com.llm_ops.demo.organization.domain.OrganizationStatus;

public record OrganizationCreateResponse(
    Long id,
    String name,
    OrganizationStatus status
) {
    public static OrganizationCreateResponse from(Organization organization) {
        return new OrganizationCreateResponse(
            organization.getId(),
            organization.getName(),
            organization.getStatus()
        );
    }
}
