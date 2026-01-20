package com.llm_ops.demo.gateway.dto;

/**
 * 게이트웨이 채팅 API (`/v1/chat/completions`)의 응답 본문을 위한 DTO 레코드입니다.
 *
 * @param traceId    요청 추적을 위한 고유 ID
 * @param answer     LLM이 생성한 최종 답변 텍스트
 * @param isFailover 주 모델 실패로 예비(fallback) 모델이 사용되었는지 여부
 * @param usedModel  실제로 답변 생성에 사용된 모델의 이름
 * @param usage      토큰 사용량 및 예상 비용 정보
 */
public record GatewayChatResponse(
        String traceId,
        String answer,
        boolean isFailover,
        String usedModel,
        GatewayChatUsage usage
) {
    public static GatewayChatResponse create(
            String traceId,
            String answer,
            boolean isFailover,
            String usedModel,
            GatewayChatUsage usage
    ) {
        return new GatewayChatResponse(traceId, answer, isFailover, usedModel, usage);
    }
}
