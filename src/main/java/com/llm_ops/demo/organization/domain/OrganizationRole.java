package com.llm_ops.demo.organization.domain;

public enum OrganizationRole {
    OWNER,
    ADMIN,
    MEMBER;

    public boolean canManageMembers(){
        return this == OrganizationRole.OWNER || this == OrganizationRole.ADMIN;
    }
}
