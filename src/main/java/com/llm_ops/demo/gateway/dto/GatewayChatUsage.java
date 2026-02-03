package com.llm_ops.demo.gateway.dto;

/**
 * 게이트웨이 채팅 API 응답에 포함될 리소스 사용량 정보를 위한 DTO 레코드입니다.
 * '예산 가드레일' 기능의 핵심 요소인 비용 및 토큰 정보를 제공합니다.
 *
 * @param promptTokens   프롬프트 토큰 수
 * @param completionTokens 응답 토큰 수
 * @param totalTokens   LLM 호출에 사용된 총 토큰 수 (prompt + completion)
 * @param estimatedCost API 호출에 대한 예상 비용
 */
public record GatewayChatUsage(
        Long promptTokens,
        Long completionTokens,
        Long totalTokens,
        Double estimatedCost
) {
}
