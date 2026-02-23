package com.llm_ops.demo.eval.dto;

import com.llm_ops.demo.eval.domain.EvalReleaseCriteriaAudit;
import java.time.LocalDateTime;

public record EvalReleaseCriteriaAuditResponse(
        Long id,
        Long workspaceId,
        Double minPassRate,
        Double minAvgOverallScore,
        Double maxErrorRate,
        Double minImprovementNoticeDelta,
        Long changedBy,
        LocalDateTime changedAt
) {

    public static EvalReleaseCriteriaAuditResponse from(EvalReleaseCriteriaAudit audit) {
        return new EvalReleaseCriteriaAuditResponse(
                audit.getId(),
                audit.getWorkspaceId(),
                audit.getMinPassRate(),
                audit.getMinAvgOverallScore(),
                audit.getMaxErrorRate(),
                audit.getMinImprovementNoticeDelta(),
                audit.getChangedBy(),
                audit.getChangedAt()
        );
    }
}
