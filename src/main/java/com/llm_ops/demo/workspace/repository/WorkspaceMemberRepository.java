package com.llm_ops.demo.workspace.repository;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.organization.domain.Organization;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.domain.WorkspaceMember;
import com.llm_ops.demo.workspace.domain.WorkspaceRole;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkspaceMemberRepository extends JpaRepository<WorkspaceMember, Long> {

    Optional<WorkspaceMember> findByWorkspaceAndUser(Workspace workspace, User user);

    @Query("SELECT wm FROM WorkspaceMember wm " +
           "JOIN FETCH wm.workspace w " +
           "JOIN FETCH w.organization o " +
           "WHERE wm.user = :user " +
           "AND o.status = com.llm_ops.demo.organization.domain.OrganizationStatus.ACTIVE " +
           "ORDER BY w.createdAt DESC")
    List<WorkspaceMember> findByUserWithWorkspaceAndOrganization(@Param("user") User user);

    List<WorkspaceMember> findByWorkspace(Workspace workspace);

    List<WorkspaceMember> findByUser(User user);

    boolean existsByWorkspaceAndUser(Workspace workspace, User user);

    long countByWorkspaceAndRole(Workspace workspace, WorkspaceRole role);

    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM WorkspaceMember wm " +
           "WHERE wm.user = :user " +
           "AND wm.workspace.organization = :organization")
    void deleteByUserAndOrganization(@Param("user") User user, @Param("organization") Organization organization);
}
