package com.llm_ops.demo.workspace.dto;

import com.llm_ops.demo.workspace.domain.WorkspaceRole;
import jakarta.validation.constraints.NotNull;

public record WorkspaceInviteCreateRequest(
    @NotNull(message = "역할은 필수입니다.")
    WorkspaceRole role
) {}
