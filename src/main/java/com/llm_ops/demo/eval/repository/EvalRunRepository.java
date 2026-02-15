package com.llm_ops.demo.eval.repository;

import com.llm_ops.demo.eval.domain.EvalRun;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EvalRunRepository extends JpaRepository<EvalRun, Long> {

    @EntityGraph(attributePaths = {"prompt", "prompt.workspace", "prompt.workspace.organization", "promptVersion", "dataset"})
    List<EvalRun> findByPromptIdOrderByCreatedAtDesc(Long promptId);

    @EntityGraph(attributePaths = {"prompt", "prompt.workspace", "prompt.workspace.organization", "promptVersion", "dataset"})
    Optional<EvalRun> findByIdAndPromptId(Long id, Long promptId);

    @EntityGraph(attributePaths = {"prompt", "prompt.workspace", "prompt.workspace.organization", "promptVersion", "dataset"})
    List<EvalRun> findTop10ByStatusOrderByCreatedAtAsc(String status);

    @EntityGraph(attributePaths = {"prompt", "prompt.workspace", "prompt.workspace.organization", "promptVersion", "dataset"})
    Optional<EvalRun> findById(Long id);
}
