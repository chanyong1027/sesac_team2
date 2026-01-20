package com.llm_ops.demo.keys.dto;

import com.llm_ops.demo.keys.domain.OrganizationApiKey;

import java.time.LocalDateTime;

/**
 * 조직 API 키의 요약 정보를 담는 DTO 레코드입니다.
 * 목록 조회 시 사용되며, 보안을 위해 키의 실제 값이 아닌 접두사(prefix) 등 안전한 정보만 포함합니다.
 *
 * @param id          API 키의 고유 ID
 * @param name        키 식별용 이름
 * @param keyPrefix   키의 접두사
 * @param lastUsedAt  마지막 사용 일시
 * @param createdAt   생성 일시
 */
public record OrganizationApiKeySummaryResponse(
        Long id,
        String name,
        String keyPrefix,
        LocalDateTime lastUsedAt,
        LocalDateTime createdAt
) {
    /**
     * OrganizationApiKey 엔티티로부터 요약 DTO를 생성합니다.
     *
     * @param apiKey 원본 엔티티
     * @return 요약 정보가 담긴 DTO
     */
    public static OrganizationApiKeySummaryResponse from(OrganizationApiKey apiKey) {
        return new OrganizationApiKeySummaryResponse(
                apiKey.getId(),
                apiKey.getName(),
                apiKey.getKeyPrefix(),
                apiKey.getLastUsedAt(),
                apiKey.getCreatedAt()
        );
    }
}

