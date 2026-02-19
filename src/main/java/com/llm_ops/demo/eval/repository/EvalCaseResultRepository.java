package com.llm_ops.demo.eval.repository;

import com.llm_ops.demo.eval.domain.EvalCaseResult;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EvalCaseResultRepository extends JpaRepository<EvalCaseResult, Long> {

    @EntityGraph(attributePaths = {"evalRun", "evalRun.prompt", "evalRun.promptVersion", "testCase"})
    List<EvalCaseResult> findByEvalRunIdOrderByIdAsc(Long evalRunId);

    @EntityGraph(attributePaths = {"evalRun", "evalRun.prompt", "evalRun.promptVersion", "testCase"})
    Page<EvalCaseResult> findByEvalRunIdOrderByIdAsc(Long evalRunId, Pageable pageable);

    @EntityGraph(attributePaths = {"evalRun", "evalRun.prompt", "evalRun.promptVersion", "testCase"})
    Optional<EvalCaseResult> findByIdAndEvalRunId(Long id, Long evalRunId);

    @EntityGraph(attributePaths = {"evalRun", "evalRun.prompt", "evalRun.promptVersion", "testCase"})
    List<EvalCaseResult> findByEvalRunIdAndStatusOrderByIdAsc(Long evalRunId, String status);
}
