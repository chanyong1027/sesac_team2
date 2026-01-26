package com.llm_ops.demo.organization.dto;

import com.llm_ops.demo.organization.domain.OrganizationRole;
import jakarta.validation.constraints.NotNull;

public record OrganizationMemberRoleUpdateRequest (
        @NotNull(message = "역할은 필수입니다.")
        OrganizationRole role
) {}
