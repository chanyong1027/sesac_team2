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
import java.util.Map;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "eval_case_results")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EvalCaseResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "eval_run_id", nullable = false)
    private EvalRun evalRun;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "test_case_id", nullable = false)
    private EvalTestCase testCase;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "candidate_output_text", columnDefinition = "TEXT")
    private String candidateOutputText;

    @Column(name = "baseline_output_text", columnDefinition = "TEXT")
    private String baselineOutputText;

    @Column(name = "candidate_meta_json")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> candidateMetaJson;

    @Column(name = "baseline_meta_json")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> baselineMetaJson;

    @Column(name = "rule_checks_json")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> ruleChecksJson;

    @Column(name = "judge_output_json")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> judgeOutputJson;

    @Column(name = "overall_score")
    private Double overallScore;

    @Column(name = "pass")
    private Boolean pass;

    @Column(name = "error_code", length = 120)
    private String errorCode;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public static EvalCaseResult queue(EvalRun evalRun, EvalTestCase testCase) {
        EvalCaseResult result = new EvalCaseResult();
        result.evalRun = evalRun;
        result.testCase = testCase;
        result.status = EvalCaseStatus.QUEUED.name();
        return result;
    }

    public EvalCaseStatus status() {
        return EvalCaseStatus.valueOf(status);
    }

    public void markRunning() {
        status = EvalCaseStatus.RUNNING.name();
        startedAt = LocalDateTime.now();
    }

    public void markOk(
            String candidateOutputText,
            String baselineOutputText,
            Map<String, Object> candidateMetaJson,
            Map<String, Object> baselineMetaJson,
            Map<String, Object> ruleChecksJson,
            Map<String, Object> judgeOutputJson,
            Double overallScore,
            Boolean pass
    ) {
        this.status = EvalCaseStatus.OK.name();
        this.candidateOutputText = candidateOutputText;
        this.baselineOutputText = baselineOutputText;
        this.candidateMetaJson = candidateMetaJson;
        this.baselineMetaJson = baselineMetaJson;
        this.ruleChecksJson = ruleChecksJson;
        this.judgeOutputJson = judgeOutputJson;
        this.overallScore = overallScore;
        this.pass = pass;
        this.errorCode = null;
        this.errorMessage = null;
        this.completedAt = LocalDateTime.now();
    }

    public void markError(String errorCode, String errorMessage) {
        this.status = EvalCaseStatus.ERROR.name();
        this.errorCode = errorCode;
        this.errorMessage = errorMessage;
        this.completedAt = LocalDateTime.now();
    }
}
