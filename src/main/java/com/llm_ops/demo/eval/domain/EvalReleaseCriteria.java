package com.llm_ops.demo.eval.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "eval_release_criteria")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EvalReleaseCriteria {

    private static final double DEFAULT_MIN_PASS_RATE = 90.0;
    private static final double DEFAULT_MIN_AVG_OVERALL_SCORE = 75.0;
    private static final double DEFAULT_MAX_ERROR_RATE = 10.0;
    private static final double DEFAULT_MIN_IMPROVEMENT_NOTICE_DELTA = 3.0;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "workspace_id", nullable = false, unique = true)
    private Long workspaceId;

    @Column(name = "min_pass_rate", nullable = false)
    private Double minPassRate;

    @Column(name = "min_avg_overall_score", nullable = false)
    private Double minAvgOverallScore;

    @Column(name = "max_error_rate", nullable = false)
    private Double maxErrorRate;

    @Column(name = "min_improvement_notice_delta", nullable = false)
    private Double minImprovementNoticeDelta;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "updated_by")
    private Long updatedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public static EvalReleaseCriteria createDefault(Long workspaceId) {
        EvalReleaseCriteria criteria = new EvalReleaseCriteria();
        criteria.workspaceId = workspaceId;
        criteria.minPassRate = DEFAULT_MIN_PASS_RATE;
        criteria.minAvgOverallScore = DEFAULT_MIN_AVG_OVERALL_SCORE;
        criteria.maxErrorRate = DEFAULT_MAX_ERROR_RATE;
        criteria.minImprovementNoticeDelta = DEFAULT_MIN_IMPROVEMENT_NOTICE_DELTA;
        return criteria;
    }

    public void update(
            Double minPassRate,
            Double minAvgOverallScore,
            Double maxErrorRate,
            Double minImprovementNoticeDelta,
            Long actorUserId
    ) {
        this.minPassRate = normalize(minPassRate, DEFAULT_MIN_PASS_RATE);
        this.minAvgOverallScore = normalize(minAvgOverallScore, DEFAULT_MIN_AVG_OVERALL_SCORE);
        this.maxErrorRate = normalize(maxErrorRate, DEFAULT_MAX_ERROR_RATE);
        this.minImprovementNoticeDelta = normalize(minImprovementNoticeDelta, DEFAULT_MIN_IMPROVEMENT_NOTICE_DELTA);
        this.updatedBy = actorUserId;
        if (this.createdBy == null) {
            this.createdBy = actorUserId;
        }
    }

    private static double normalize(Double value, double fallback) {
        if (value == null || Double.isNaN(value) || Double.isInfinite(value)) {
            return fallback;
        }
        return value;
    }
}
