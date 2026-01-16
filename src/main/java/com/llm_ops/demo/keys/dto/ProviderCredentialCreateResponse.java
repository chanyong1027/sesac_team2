package com.llm_ops.demo.keys.dto;

import com.llm_ops.demo.keys.domain.ProviderCredential;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class ProviderCredentialCreateResponse {

    private final Long credentialId;
    private final String provider;
    private final String status;
    private final LocalDateTime createdAt;
    private final LocalDateTime lastVerifiedAt;

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
