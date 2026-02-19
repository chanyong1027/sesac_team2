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

    /**
     * 토큰으로 초대 링크 조회 (N+1 방지: workspace, organization 함께 로드)
     * 초대 수락 시 사용 - workspace와 organization 정보가 모두 필요함
     *
     * @param token 초대 토큰
     * @return 초대 링크 (workspace, organization 포함)
     */
    @Query("SELECT wil FROM WorkspaceInvitationLink wil " +
           "JOIN FETCH wil.workspace w " +
           "JOIN FETCH w.organization " +
           "WHERE wil.token = :token")
    Optional<WorkspaceInvitationLink> findByTokenWithWorkspaceAndOrganization(
        @Param("token") String token
    );

    @Query("SELECT wil FROM WorkspaceInvitationLink wil " +
           "JOIN FETCH wil.workspace w " +
           "JOIN FETCH w.organization " +
           "JOIN FETCH wil.createdBy " +
           "WHERE wil.token = :token")
    Optional<WorkspaceInvitationLink> findByTokenWithWorkspaceOrganizationAndCreator(
        @Param("token") String token
    );
}
