package com.llm_ops.demo.workspace.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 워크스페이스 초대 수락 요청 DTO
 *
 * @param token 초대 링크 토큰 (UUID 형식)
 */
public record WorkspaceInviteAcceptRequest(
    @NotBlank(message = "초대 토큰은 필수입니다.")
    String token
) {}
