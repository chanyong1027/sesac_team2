package com.llm_ops.demo.keys.dto;

import com.llm_ops.demo.keys.domain.OrganizationApiKey;

import java.time.LocalDateTime;

public record OrganizationApiKeySummaryResponse(
        Long id,
        String name,
        String keyPrefix,
        LocalDateTime lastUsedAt,
        LocalDateTime createdAt
) {
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

