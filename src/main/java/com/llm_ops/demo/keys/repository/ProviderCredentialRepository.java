package com.llm_ops.demo.keys.repository;

import com.llm_ops.demo.keys.domain.ProviderCredential;
import com.llm_ops.demo.keys.domain.ProviderType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProviderCredentialRepository extends JpaRepository<ProviderCredential, Long> {
    boolean existsByOrganizationIdAndProvider(Long organizationId, ProviderType provider);

    Optional<ProviderCredential> findByOrganizationIdAndProvider(Long organizationId, ProviderType provider);

    List<ProviderCredential> findAllByOrganizationId(Long organizationId);
}
