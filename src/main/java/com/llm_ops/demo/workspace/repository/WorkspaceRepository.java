package com.llm_ops.demo.workspace.repository;

import com.llm_ops.demo.organization.domain.Organization;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.domain.WorkspaceStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkspaceRepository extends JpaRepository<Workspace, Long> {

    Optional<Workspace> findByIdAndStatus(Long id, WorkspaceStatus status);

    List<Workspace> findByOrganization(Organization organization);

    List<Workspace> findByOrganizationAndStatus(Organization organization, WorkspaceStatus status);

    boolean existsByOrganizationAndName(Organization organization, String name);
}
