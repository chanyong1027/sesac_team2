package com.llm_ops.demo.workspace.domain;

public enum WorkspaceRole {
    OWNER,
    MEMBER;

    public boolean isOwner() {
        return this == OWNER;
    }
}
