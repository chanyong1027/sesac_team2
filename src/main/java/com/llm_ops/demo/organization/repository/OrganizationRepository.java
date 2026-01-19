package com.llm_ops.demo.organization.repository;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.organization.domain.Organization;
import com.llm_ops.demo.organization.domain.OrganizationStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationRepository extends JpaRepository<Organization, Long> {

    Optional<Organization> findByIdAndStatus(Long id, OrganizationStatus status);

    List<Organization> findByCreatedBy(User user);

    boolean existsByIdAndStatus(Long id, OrganizationStatus status);

    boolean existsByCreatedByAndNameAndStatus(User user, String name, OrganizationStatus status);
}
