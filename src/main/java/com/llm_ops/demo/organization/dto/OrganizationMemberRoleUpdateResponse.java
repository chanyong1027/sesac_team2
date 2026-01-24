package com.llm_ops.demo.organization.dto;

import com.llm_ops.demo.organization.domain.OrganizationRole;
import java.time.LocalDateTime;

public record OrganizationMemberRoleUpdateResponse(
        Long memberId,
        OrganizationRole previousRole,
        OrganizationRole newRole,
        LocalDateTime updatedAt
) {
    public static OrganizationMemberRoleUpdateResponse from(
            Long memberId,
            OrganizationRole previousRole,
            OrganizationRole newRole
    ) {
        return new OrganizationMemberRoleUpdateResponse(
                memberId, previousRole, newRole, LocalDateTime.now()
        );
    }
}
