package com.llm_ops.demo.keys.dto;

import jakarta.validation.constraints.Size;

/**
 * API 키 교체(Rotate) 요청 DTO입니다.
 *
 * @param reason 교체 사유 (선택적, audit 용도)
 */
public record OrganizationApiKeyRotateRequest(
        @Size(max = 255, message = "사유는 255자 이내여야 합니다.")
        String reason
) {
}
