package com.llm_ops.demo.eval.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "eval_case_result_human_review_audits")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EvalCaseResultHumanReviewAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "workspace_id", nullable = false)
    private Long workspaceId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "eval_run_id", nullable = false)
    private EvalRun evalRun;

    @Column(name = "eval_run_id", insertable = false, updatable = false)
    private Long evalRunId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "eval_case_result_id", nullable = false)
    private EvalCaseResult evalCaseResult;

    @Column(name = "eval_case_result_id", insertable = false, updatable = false)
    private Long evalCaseResultId;

    @Enumerated(EnumType.STRING)
    @Column(name = "review_verdict", nullable = false, length = 20)
    private EvalHumanReviewVerdict reviewVerdict;

    @Column(name = "override_pass")
    private Boolean overridePass;

    @Column(name = "comment", columnDefinition = "TEXT")
    private String comment;

    @Column(name = "category", length = 50)
    private String category;

    @Column(name = "request_id", length = 120)
    private String requestId;

    @Column(name = "changed_by")
    private Long changedBy;

    @CreationTimestamp
    @Column(name = "changed_at", nullable = false, updatable = false)
    private OffsetDateTime changedAt;

    public Long getId() {
        return id;
    }

    public Long getWorkspaceId() {
        return workspaceId;
    }

    public Long getEvalRunId() {
        return evalRunId;
    }

    public Long getEvalCaseResultId() {
        return evalCaseResultId;
    }

    public EvalHumanReviewVerdict getReviewVerdict() {
        return reviewVerdict;
    }

    public Boolean getOverridePass() {
        return overridePass;
    }

    public String getComment() {
        return comment;
    }

    public String getCategory() {
        return category;
    }

    public String getRequestId() {
        return requestId;
    }

    public Long getChangedBy() {
        return changedBy;
    }

    public OffsetDateTime getChangedAt() {
        return changedAt;
    }

    public static EvalCaseResultHumanReviewAudit create(
            Long workspaceId,
            EvalRun evalRun,
            EvalCaseResult evalCaseResult,
            EvalHumanReviewVerdict reviewVerdict,
            Boolean overridePass,
            String comment,
            String category,
            String requestId,
            Long changedBy
    ) {
        EvalCaseResultHumanReviewAudit audit = new EvalCaseResultHumanReviewAudit();
        audit.workspaceId = workspaceId;
        audit.evalRun = evalRun;
        audit.evalCaseResult = evalCaseResult;
        audit.reviewVerdict = reviewVerdict;
        audit.overridePass = overridePass;
        audit.comment = comment;
        audit.category = category;
        audit.requestId = requestId;
        audit.changedBy = changedBy;
        return audit;
    }
}
