package com.llm_ops.demo.prompt.repository;

import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptStatus;
import com.llm_ops.demo.workspace.domain.Workspace;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PromptRepository extends JpaRepository<Prompt, Long> {

    Optional<Prompt> findByIdAndStatus(Long id, PromptStatus status);

    List<Prompt> findByWorkspaceAndStatusOrderByCreatedAtDesc(Workspace workspace, PromptStatus status);

    Optional<Prompt> findByWorkspaceAndPromptKeyAndStatus(Workspace workspace, String promptKey, PromptStatus status);

    boolean existsByWorkspaceAndPromptKey(Workspace workspace, String promptKey);
}
