package com.llm_ops.demo.eval.domain;

import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptVersion;
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
import java.time.Duration;
import java.util.Map;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "eval_runs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EvalRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prompt_id", nullable = false)
    private Prompt prompt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prompt_version_id", nullable = false)
    private PromptVersion promptVersion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dataset_id", nullable = false)
    private EvalDataset dataset;

    @Column(name = "workspace_id", nullable = false)
    private Long workspaceId;

    @Column(name = "mode", nullable = false, length = 30)
    private String mode;

    @Column(name = "trigger_type", nullable = false, length = 30)
    private String triggerType;

    @Column(name = "rubric_template_code", nullable = false, length = 50)
    private String rubricTemplateCode;

    @Column(name = "rubric_overrides_json")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> rubricOverridesJson;

    @Column(name = "candidate_provider", length = 50)
    private String candidateProvider;

    @Column(name = "candidate_model", length = 120)
    private String candidateModel;

    @Column(name = "judge_provider", length = 50)
    private String judgeProvider;

    @Column(name = "judge_model", length = 120)
    private String judgeModel;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "total_cases", nullable = false)
    private int totalCases;

    @Column(name = "processed_cases", nullable = false)
    private int processedCases;

    @Column(name = "passed_cases", nullable = false)
    private int passedCases;

    @Column(name = "failed_cases", nullable = false)
    private int failedCases;

    @Column(name = "error_cases", nullable = false)
    private int errorCases;

    @Column(name = "summary_json")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> summaryJson;

    @Column(name = "cost_json")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> costJson;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "timeout_at")
    private LocalDateTime timeoutAt;

    @Column(name = "fail_reason_code", length = 50)
    private String failReasonCode;

    @Column(name = "fail_reason", length = 500)
    private String failReason;
    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    // Explicit getters for IDE/LSP environments without Lombok support
    public Long getId() {
        return id;
    }

    public static EvalRun queue(
            Prompt prompt,
            PromptVersion promptVersion,
            EvalDataset dataset,
            Long workspaceId,
            EvalMode mode,
            EvalTriggerType triggerType,
            RubricTemplateCode rubricTemplateCode,
            Map<String, Object> rubricOverridesJson,
            String candidateProvider,
            String candidateModel,
            String judgeProvider,
            String judgeModel,
            int totalCases,
            Long createdBy
    ) {
        EvalRun run = new EvalRun();
        run.prompt = prompt;
        run.promptVersion = promptVersion;
        run.dataset = dataset;
        run.workspaceId = workspaceId;
        run.mode = mode.name();
        run.triggerType = triggerType.name();
        run.rubricTemplateCode = rubricTemplateCode.name();
        run.rubricOverridesJson = rubricOverridesJson;
        run.candidateProvider = candidateProvider;
        run.candidateModel = candidateModel;
        run.judgeProvider = judgeProvider;
        run.judgeModel = judgeModel;
        run.status = EvalRunStatus.QUEUED.name();
        run.totalCases = totalCases;
        run.processedCases = 0;
        run.passedCases = 0;
        run.failedCases = 0;
        run.errorCases = 0;
        run.createdBy = createdBy;
        return run;
    }

    public EvalRunStatus status() {
        return EvalRunStatus.valueOf(status);
    }

    public EvalMode mode() {
        return EvalMode.valueOf(mode);
    }

    public RubricTemplateCode rubricTemplateCode() {
        return RubricTemplateCode.valueOf(rubricTemplateCode);
    }

    public void markRunning() {
        if (status() == EvalRunStatus.QUEUED) {
            status = EvalRunStatus.RUNNING.name();
            startedAt = LocalDateTime.now();
        }
    }

    public void markRunningWithTimeout(Duration maxDuration) {
        if (status() == EvalRunStatus.QUEUED) {
            status = EvalRunStatus.RUNNING.name();
            startedAt = LocalDateTime.now();
            timeoutAt = startedAt.plus(maxDuration);
        }
    }

    public boolean ensureTimeoutIfMissing(Duration maxDuration) {
        if (status() == EvalRunStatus.RUNNING && startedAt != null && timeoutAt == null) {
            timeoutAt = startedAt.plus(maxDuration);
            return true;
        }
        return false;
    }

    public boolean isTimedOut() {
        if (timeoutAt == null) {
            return false;
        }
        return LocalDateTime.now().isAfter(timeoutAt);
    }

    public void fail(String reasonCode, String reasonMessage) {
        this.status = EvalRunStatus.FAILED.name();
        this.failReasonCode = reasonCode;
        this.failReason = reasonMessage;
        this.completedAt = LocalDateTime.now();
    }


    public void markCancelled() {
        if (status() == EvalRunStatus.QUEUED || status() == EvalRunStatus.RUNNING) {
            status = EvalRunStatus.CANCELLED.name();
            completedAt = LocalDateTime.now();
        }
    }

    public void onCaseOk(boolean pass) {
        processedCases++;
        if (pass) {
            passedCases++;
        } else {
            failedCases++;
        }
    }

    public void onCaseError() {
        processedCases++;
        errorCases++;
    }

    public void finish(Map<String, Object> summaryJson, Map<String, Object> costJson) {
        this.summaryJson = summaryJson;
        this.costJson = costJson;
        this.status = EvalRunStatus.COMPLETED.name();
        this.completedAt = LocalDateTime.now();
    }

    public void fail(Map<String, Object> summaryJson, Map<String, Object> costJson) {
        this.summaryJson = summaryJson;
        this.costJson = costJson;
        this.status = EvalRunStatus.FAILED.name();
        this.completedAt = LocalDateTime.now();
    }

    public void resetToQueued() {
        this.status = EvalRunStatus.QUEUED.name();
        this.startedAt = null;
        this.timeoutAt = null;
    }

}
