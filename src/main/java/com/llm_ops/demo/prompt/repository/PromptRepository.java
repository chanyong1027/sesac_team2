package com.llm_ops.demo.prompt.repository;

import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptStatus;
import com.llm_ops.demo.workspace.domain.Workspace;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PromptRepository extends JpaRepository<Prompt, Long> {

    Optional<Prompt> findByIdAndStatus(Long id, PromptStatus status);

    @Query("SELECT p FROM Prompt p JOIN FETCH p.workspace w JOIN FETCH w.organization WHERE p.id = :id AND p.status = :status")
    Optional<Prompt> findByIdAndStatusWithWorkspaceAndOrganization(@Param("id") Long id, @Param("status") PromptStatus status);

    List<Prompt> findByWorkspaceAndStatusOrderByCreatedAtDesc(Workspace workspace, PromptStatus status);

    Optional<Prompt> findByWorkspaceAndPromptKeyAndStatus(Workspace workspace, String promptKey, PromptStatus status);

    boolean existsByWorkspaceAndPromptKey(Workspace workspace, String promptKey);
}
