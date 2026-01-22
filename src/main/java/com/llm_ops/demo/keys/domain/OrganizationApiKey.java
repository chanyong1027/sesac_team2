package com.llm_ops.demo.keys.domain;

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
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * 외부 서비스가 LuminaOps 게이트웨이를 호출할 때 사용하는 API 키를 나타내는 엔티티입니다.
 * 이 키는 조직(Organization) 단위로 발급되며, 실제 키 값 대신 해시된 값과 접두사를 저장하여 보안을 강화합니다.
 */
@Entity
@Table(
        name = "organization_api_keys",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uq_organization_api_keys_organization_name",
                        columnNames = {"organization_id", "name"}
                ),
                @UniqueConstraint(
                        name = "uq_organization_api_keys_key_hash",
                        columnNames = {"key_hash"}
                )
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OrganizationApiKey {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 이 API 키를 소유한 조직의 ID
     */
    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    /**
     * 사용자가 키를 식별하기 위해 부여한 이름
     */
    @Column(name = "name", nullable = false, length = 100)
    private String name;

    /**
     * 실제 API 키의 SHA-256 해시 값. 인증에 사용됩니다.
     */
    @Column(name = "key_hash", nullable = false, length = 64)
    private String keyHash;

    /**
     * 키의 앞 부분을 잘라낸 문자열. UI나 로그에서 키를 식별하는 용도로 사용됩니다.
     */
    @Column(name = "key_prefix", nullable = false, length = 32)
    private String keyPrefix;

    /**
     * API 키의 현재 상태 (예: ACTIVE, INACTIVE)
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private OrganizationApiKeyStatus status;

    /**
     * 이 키가 마지막으로 사용된 시간
     */
    @Column(name = "last_used_at")
    private LocalDateTime lastUsedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private OrganizationApiKey(
            Long organizationId,
            String name,
            String keyHash,
            String keyPrefix,
            OrganizationApiKeyStatus status
    ) {
        this.organizationId = organizationId;
        this.name = name;
        this.keyHash = keyHash;
        this.keyPrefix = keyPrefix;
        this.status = status;
    }

    /**
     * 새로운 OrganizationApiKey 엔티티를 생성합니다.
     *
     * @param organizationId 이 키를 소유할 조직의 ID
     * @param name           키 식별용 이름
     * @param keyHash        키의 SHA-256 해시 값
     * @param keyPrefix      키의 접두사
     * @return 활성(ACTIVE) 상태의 새로운 OrganizationApiKey 인스턴스
     */
    public static OrganizationApiKey create(
            Long organizationId,
            String name,
            String keyHash,
            String keyPrefix
    ) {
        return new OrganizationApiKey(
                organizationId,
                name,
                keyHash,
                keyPrefix,
                OrganizationApiKeyStatus.ACTIVE
        );
    }
}
