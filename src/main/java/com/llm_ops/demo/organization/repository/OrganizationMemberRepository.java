package com.llm_ops.demo.organization.repository;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.organization.domain.Organization;
import com.llm_ops.demo.organization.domain.OrganizationMember;
import com.llm_ops.demo.organization.domain.OrganizationRole;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrganizationMemberRepository extends JpaRepository<OrganizationMember, Long> {

    Optional<OrganizationMember> findByOrganizationAndUser(Organization organization, User user);

    List<OrganizationMember> findByOrganization(Organization organization);

    List<OrganizationMember> findByUser(User user);

    boolean existsByOrganizationAndUser(Organization organization, User user);

    long countByOrganizationAndRole(Organization organization, OrganizationRole role);

    @Query("SELECT om FROM OrganizationMember om " +
           "JOIN FETCH om.user " +
           "WHERE om.organization = :organization")
    List<OrganizationMember> findByOrganizationWithUser(@Param("organization") Organization organization);
}
