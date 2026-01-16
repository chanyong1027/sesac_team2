package com.llm_ops.demo.keys.dto;

import com.llm_ops.demo.keys.domain.ProviderCredential;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class ProviderCredentialSummaryResponse {

    private final String provider;
    private final String status;
    private final LocalDateTime lastVerifiedAt;
    private final LocalDateTime createdAt;

    public static ProviderCredentialSummaryResponse from(ProviderCredential credential) {
        return new ProviderCredentialSummaryResponse(
                credential.getProvider().getValue(),
                credential.getStatus().name(),
                credential.getLastVerifiedAt(),
                credential.getCreatedAt()
        );
    }
}
