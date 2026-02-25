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
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
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

    @Enumerated(EnumType.STRING)
    @Column(name = "human_review_verdict", nullable = false, length = 20)
    private EvalHumanReviewVerdict humanReviewVerdict = EvalHumanReviewVerdict.UNREVIEWED;

    @Column(name = "human_override_pass")
    private Boolean humanOverridePass;

    @Column(name = "human_review_comment", columnDefinition = "TEXT")
    private String humanReviewComment;

    @Column(name = "human_review_category", length = 50)
    private String humanReviewCategory;

    @Column(name = "human_reviewed_by")
    private Long humanReviewedBy;

    @Column(name = "human_reviewed_at")
    private OffsetDateTime humanReviewedAt;

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

    @Column(name = "eval_run_id", insertable = false, updatable = false)
    private Long evalRunId;

    @Column(name = "test_case_id", insertable = false, updatable = false)
    private Long testCaseId;


    // Explicit getters for IDE/LSP environments without Lombok support
    public Long getId() {
        return id;
    }

    public Long getEvalRunId() {
        return evalRunId;
    }

    public Long getTestCaseId() {
        return testCaseId;
    }


    public EvalRun getEvalRun() {
        return evalRun;
    }

    public EvalTestCase getTestCase() {
        return testCase;
    }

    public String getCandidateOutputText() {
        return candidateOutputText;
    }

    public String getBaselineOutputText() {
        return baselineOutputText;
    }

    public Map<String, Object> getCandidateMetaJson() {
        return candidateMetaJson;
    }

    public Map<String, Object> getBaselineMetaJson() {
        return baselineMetaJson;
    }

    public Map<String, Object> getRuleChecksJson() {
        return ruleChecksJson;
    }

    public Map<String, Object> getJudgeOutputJson() {
        return judgeOutputJson;
    }

    public Double getOverallScore() {
        return overallScore;
    }

    public Boolean getPass() {
        return pass;
    }

    public EvalHumanReviewVerdict getHumanReviewVerdict() {
        return humanReviewVerdict;
    }

    public Boolean getHumanOverridePass() {
        return humanOverridePass;
    }

    public String getHumanReviewComment() {
        return humanReviewComment;
    }

    public String getHumanReviewCategory() {
        return humanReviewCategory;
    }

    public Long getHumanReviewedBy() {
        return humanReviewedBy;
    }

    public OffsetDateTime getHumanReviewedAt() {
        return humanReviewedAt;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public LocalDateTime getStartedAt() {
        return startedAt;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }

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

    public void resetToQueuedForRecovery() {
        if (!EvalCaseStatus.RUNNING.name().equals(this.status)) {
            return;
        }
        this.status = EvalCaseStatus.QUEUED.name();
        this.candidateOutputText = null;
        this.baselineOutputText = null;
        this.candidateMetaJson = null;
        this.baselineMetaJson = null;
        this.ruleChecksJson = null;
        this.judgeOutputJson = null;
        this.overallScore = null;
        this.pass = null;
        this.errorCode = null;
        this.errorMessage = null;
        this.startedAt = null;
        this.completedAt = null;
    }

    public Boolean effectivePass() {
        if (humanReviewVerdict == EvalHumanReviewVerdict.INCORRECT && humanOverridePass != null) {
            return humanOverridePass;
        }
        return pass;
    }

    public void applyHumanReviewUpdate(
            EvalHumanReviewVerdict verdict,
            Boolean overridePass,
            String comment,
            String category,
            Long reviewedBy,
            OffsetDateTime reviewedAt
    ) {
        if (verdict == EvalHumanReviewVerdict.INCORRECT && overridePass == null) {
            throw new IllegalArgumentException("overridePass is required when verdict is INCORRECT");
        }
        this.humanReviewVerdict = verdict == null ? EvalHumanReviewVerdict.UNREVIEWED : verdict;
        this.humanOverridePass = overridePass;
        this.humanReviewComment = comment;
        this.humanReviewCategory = category;
        this.humanReviewedBy = reviewedBy;
        this.humanReviewedAt = reviewedAt;
    }
}
