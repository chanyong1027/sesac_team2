package com.llm_ops.demo.eval.repository;

import com.llm_ops.demo.eval.domain.EvalCaseResultHumanReviewAudit;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EvalCaseResultHumanReviewAuditRepository
        extends JpaRepository<EvalCaseResultHumanReviewAudit, Long> {

    List<EvalCaseResultHumanReviewAudit> findTop20ByEvalCaseResultIdOrderByChangedAtDesc(Long evalCaseResultId);

    boolean existsByEvalCaseResultIdAndRequestId(Long evalCaseResultId, String requestId);
}
