package com.llm_ops.demo.eval.repository;

import com.llm_ops.demo.eval.domain.EvalReleaseCriteria;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EvalReleaseCriteriaRepository extends JpaRepository<EvalReleaseCriteria, Long> {

    Optional<EvalReleaseCriteria> findByWorkspaceId(Long workspaceId);
}
