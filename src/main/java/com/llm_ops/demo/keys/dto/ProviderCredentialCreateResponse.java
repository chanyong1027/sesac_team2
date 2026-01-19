package com.llm_ops.demo.keys.dto;

import com.llm_ops.demo.keys.domain.ProviderCredential;

import java.time.LocalDateTime;

public record ProviderCredentialCreateResponse(
        Long credentialId,
        String provider,
        String status,
        LocalDateTime createdAt,
        LocalDateTime lastVerifiedAt
) {
    public static ProviderCredentialCreateResponse from(ProviderCredential credential) {
        return new ProviderCredentialCreateResponse(
                credential.getId(),
                credential.getProvider().getValue(),
                credential.getStatus().name(),
                credential.getCreatedAt(),
                credential.getLastVerifiedAt()
        );
    }
}
