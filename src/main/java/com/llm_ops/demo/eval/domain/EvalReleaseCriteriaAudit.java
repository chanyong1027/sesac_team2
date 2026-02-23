package com.llm_ops.demo.eval.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "eval_release_criteria_audits")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EvalReleaseCriteriaAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "workspace_id", nullable = false)
    private Long workspaceId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "eval_release_criteria_id")
    private EvalReleaseCriteria evalReleaseCriteria;

    @Column(name = "min_pass_rate", nullable = false)
    private Double minPassRate;

    @Column(name = "min_avg_overall_score", nullable = false)
    private Double minAvgOverallScore;

    @Column(name = "max_error_rate", nullable = false)
    private Double maxErrorRate;

    @Column(name = "min_improvement_notice_delta", nullable = false)
    private Double minImprovementNoticeDelta;

    @Column(name = "changed_by")
    private Long changedBy;

    @CreationTimestamp
    @Column(name = "changed_at", nullable = false, updatable = false)
    private LocalDateTime changedAt;

    public static EvalReleaseCriteriaAudit create(EvalReleaseCriteria criteria, Long changedBy) {
        EvalReleaseCriteriaAudit audit = new EvalReleaseCriteriaAudit();
        audit.workspaceId = criteria.getWorkspaceId();
        audit.evalReleaseCriteria = criteria;
        audit.minPassRate = criteria.getMinPassRate();
        audit.minAvgOverallScore = criteria.getMinAvgOverallScore();
        audit.maxErrorRate = criteria.getMaxErrorRate();
        audit.minImprovementNoticeDelta = criteria.getMinImprovementNoticeDelta();
        audit.changedBy = changedBy;
        return audit;
    }
}
