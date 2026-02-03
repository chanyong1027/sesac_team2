package com.llm_ops.demo.keys.dto;

import java.time.LocalDateTime;

/**
 * API 키 교체(Rotate) 응답 DTO입니다.
 * 새로운 키의 원문은 이 응답에서만 한 번 노출됩니다.
 *
 * @param apiKey    새로 생성된 API 키 원문 (1회 노출)
 * @param rotatedAt 키 교체 시간
 */
public record OrganizationApiKeyRotateResponse(
        String apiKey,
        LocalDateTime rotatedAt
) {
}
