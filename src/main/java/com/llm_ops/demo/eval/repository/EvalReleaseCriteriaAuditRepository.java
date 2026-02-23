package com.llm_ops.demo.eval.repository;

import com.llm_ops.demo.eval.domain.EvalReleaseCriteriaAudit;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EvalReleaseCriteriaAuditRepository extends JpaRepository<EvalReleaseCriteriaAudit, Long> {

    List<EvalReleaseCriteriaAudit> findTop20ByWorkspaceIdOrderByChangedAtDesc(Long workspaceId);
}
