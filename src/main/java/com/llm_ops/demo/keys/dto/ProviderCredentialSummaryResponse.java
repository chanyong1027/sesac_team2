package com.llm_ops.demo.keys.dto;

import com.llm_ops.demo.keys.domain.ProviderCredential;

import java.time.LocalDateTime;

public record ProviderCredentialSummaryResponse(
        Long credentialId,
        String provider,
        String status,
        LocalDateTime lastVerifiedAt,
        LocalDateTime createdAt
) {
    public static ProviderCredentialSummaryResponse from(ProviderCredential credential) {
        return new ProviderCredentialSummaryResponse(
                credential.getId(),
                credential.getProvider().getValue(),
                credential.getStatus().name(),
                credential.getLastVerifiedAt(),
                credential.getCreatedAt()
        );
    }
}
