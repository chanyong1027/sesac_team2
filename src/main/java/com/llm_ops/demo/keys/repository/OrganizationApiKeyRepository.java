package com.llm_ops.demo.keys.repository;

import com.llm_ops.demo.keys.domain.OrganizationApiKey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrganizationApiKeyRepository extends JpaRepository<OrganizationApiKey, Long> {
    boolean existsByOrganizationIdAndName(Long organizationId, String name);

    List<OrganizationApiKey> findAllByOrganizationId(Long organizationId);
}

