package com.llm_ops.demo.eval.dto;

import com.llm_ops.demo.eval.domain.EvalReleaseCriteria;
import java.time.LocalDateTime;

public record EvalReleaseCriteriaResponse(
        Long workspaceId,
        Double minPassRate,
        Double minAvgOverallScore,
        Double maxErrorRate,
        Double minImprovementNoticeDelta,
        Long updatedBy,
        LocalDateTime updatedAt
) {

    public static EvalReleaseCriteriaResponse from(EvalReleaseCriteria criteria) {
        return new EvalReleaseCriteriaResponse(
                criteria.getWorkspaceId(),
                criteria.getMinPassRate(),
                criteria.getMinAvgOverallScore(),
                criteria.getMaxErrorRate(),
                criteria.getMinImprovementNoticeDelta(),
                criteria.getUpdatedBy(),
                criteria.getUpdatedAt()
        );
    }
}
