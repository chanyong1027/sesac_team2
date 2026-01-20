package com.llm_ops.demo.gateway.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Map;

/**
 * 게이트웨이 채팅 API (`/v1/chat/completions`)의 요청 본문을 위한 DTO 레코드입니다.
 *
 * @param workspaceId 이 요청이 속한 워크스페이스의 ID
 * @param promptKey   사용할 프롬프트를 식별하는 고유 키 (예: "customer_support_bot")
 * @param variables   프롬프트 템플릿에 주입될 변수들의 맵 (예: {{question}} -> "오늘 날씨 어때?")
 */
public record GatewayChatRequest(
        @NotNull Long workspaceId,
        @NotBlank String promptKey,
        Map<String, @NotNull String> variables
) {
}
