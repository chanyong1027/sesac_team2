package com.llm_ops.demo.keys.dto;

/**
 * 조직 API 키 생성 응답을 위한 DTO 레코드입니다.
 * 이 응답에는 생성된 API 키의 실제 값이 포함되며, 이 값은 오직 생성 시점에만 한 번 노출됩니다.
 *
 * @param apiKey 생성된 API 키의 원본 문자열
 */
public record OrganizationApiKeyCreateResponse(
        String apiKey
) {
}

