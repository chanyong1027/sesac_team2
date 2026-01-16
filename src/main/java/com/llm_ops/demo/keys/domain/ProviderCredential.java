package com.llm_ops.demo.keys.domain;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "provider_credential",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_provider_credential_workspace_provider",
                columnNames = {"workspace_id", "provider"}
        )
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ProviderCredential {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "workspace_id", nullable = false)
    private Long workspaceId;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", nullable = false, length = 50)
    private ProviderType provider;

    @Column(name = "key_ciphertext", nullable = false, columnDefinition = "TEXT")
    private String keyCiphertext;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ProviderCredentialStatus status;

    @Column(name = "last_verified_at")
    private LocalDateTime lastVerifiedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private ProviderCredential(
            Long workspaceId,
            ProviderType provider,
            String keyCiphertext,
            ProviderCredentialStatus status
    ) {
        this.workspaceId = workspaceId;
        this.provider = provider;
        this.keyCiphertext = keyCiphertext;
        this.status = status;
    }

    public static ProviderCredential create(
            Long workspaceId,
            ProviderType provider,
            String keyCiphertext
    ) {
        return new ProviderCredential(
                workspaceId,
                provider,
                keyCiphertext,
                ProviderCredentialStatus.ACTIVE
        );
    }
}
