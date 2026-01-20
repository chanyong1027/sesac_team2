package com.llm_ops.demo.workspace.repository;

import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.domain.WorkspaceInvitationLink;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkspaceInvitationLinkRepository extends JpaRepository<WorkspaceInvitationLink, Long> {

    Optional<WorkspaceInvitationLink> findByToken(String token);

    List<WorkspaceInvitationLink> findByWorkspace(Workspace workspace);

    boolean existsByToken(String token);

    @Query("SELECT wil FROM WorkspaceInvitationLink wil " +
           "WHERE wil.token = :token AND wil.expiredAt > :now")
    Optional<WorkspaceInvitationLink> findValidByToken(
        @Param("token") String token,
        @Param("now") LocalDateTime now
    );

    @Query("SELECT wil FROM WorkspaceInvitationLink wil " +
           "WHERE wil.workspace = :workspace AND wil.expiredAt > :now")
    List<WorkspaceInvitationLink> findValidByWorkspace(
        @Param("workspace") Workspace workspace,
        @Param("now") LocalDateTime now
    );
}
