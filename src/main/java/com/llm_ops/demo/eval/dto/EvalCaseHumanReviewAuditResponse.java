package com.llm_ops.demo.eval.dto;

import com.llm_ops.demo.eval.domain.EvalCaseResultHumanReviewAudit;
import com.llm_ops.demo.eval.domain.EvalHumanReviewVerdict;
import java.time.OffsetDateTime;

public record EvalCaseHumanReviewAuditResponse(
        Long id,
        Long workspaceId,
        Long evalRunId,
        Long evalCaseResultId,
        EvalHumanReviewVerdict verdict,
        Boolean overridePass,
        String comment,
        String category,
        String requestId,
        Long changedBy,
        OffsetDateTime changedAt
) {

    public static EvalCaseHumanReviewAuditResponse from(EvalCaseResultHumanReviewAudit audit) {
        Long evalRunId = audit.getEvalRunId();
        Long evalCaseResultId = audit.getEvalCaseResultId();

        return new EvalCaseHumanReviewAuditResponse(
                audit.getId(),
                audit.getWorkspaceId(),
                evalRunId,
                evalCaseResultId,
                audit.getReviewVerdict(),
                audit.getOverridePass(),
                audit.getComment(),
                audit.getCategory(),
                audit.getRequestId(),
                audit.getChangedBy(),
                audit.getChangedAt()
        );
    }
}
