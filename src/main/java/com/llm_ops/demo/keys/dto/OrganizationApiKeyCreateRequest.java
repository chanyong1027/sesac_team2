package com.llm_ops.demo.keys.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 조직 API 키 생성 요청을 위한 DTO 레코드입니다.
 *
 * @param name 사용자가 API 키를 식별하기 위해 지정하는 이름
 */
public record OrganizationApiKeyCreateRequest(
        @NotBlank @Size(min = 2, max = 100) String name
) {
}

