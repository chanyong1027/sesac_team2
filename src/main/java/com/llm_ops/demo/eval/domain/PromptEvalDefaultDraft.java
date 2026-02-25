package com.llm_ops.demo.eval.domain;

import com.llm_ops.demo.prompt.domain.Prompt;
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
import java.util.HashMap;
import java.util.Map;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "prompt_eval_default_drafts")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PromptEvalDefaultDraft {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prompt_id", nullable = false)
    private Prompt prompt;

    @Column(name = "dataset_id")
    private Long datasetId;

    @Column(name = "rubric_template_code", length = 50)
    private String rubricTemplateCode;

    @Column(name = "rubric_overrides_json")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> rubricOverridesJson;

    @Column(name = "criteria_anchors_json", nullable = false)
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> criteriaAnchorsJson;

    @Column(name = "default_mode", length = 30)
    private String defaultMode;

    @Column(name = "auto_eval_enabled")
    private Boolean autoEvalEnabled;

    @Column(name = "completed_sections_json", nullable = false)
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Boolean> completedSectionsJson;

    @Column(name = "updated_by", nullable = false)
    private Long updatedBy;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public static PromptEvalDefaultDraft create(Prompt prompt, Long updatedBy) {
        PromptEvalDefaultDraft draft = new PromptEvalDefaultDraft();
        draft.prompt = prompt;
        draft.updatedBy = updatedBy;
        draft.completedSectionsJson = new HashMap<>();
        draft.criteriaAnchorsJson = new HashMap<>();
        return draft;
    }

    public void updateDataset(Long datasetId, Long updatedBy) {
        this.datasetId = datasetId;
        this.updatedBy = updatedBy;
        markSectionCompleted("dataset");
    }

    public void updateRubric(
            RubricTemplateCode rubricTemplateCode,
            Map<String, Object> rubricOverridesJson,
            Map<String, Object> criteriaAnchorsJson,
            Long updatedBy
    ) {
        this.rubricTemplateCode = rubricTemplateCode != null ? rubricTemplateCode.name() : null;
        this.rubricOverridesJson = rubricOverridesJson;
        if (criteriaAnchorsJson != null) {
            this.criteriaAnchorsJson = criteriaAnchorsJson;
        } else if (this.criteriaAnchorsJson == null) {
            this.criteriaAnchorsJson = new HashMap<>();
        }
        this.updatedBy = updatedBy;
        markSectionCompleted("rubric");
    }

    public void updateMode(EvalMode defaultMode, Long updatedBy) {
        this.defaultMode = defaultMode != null ? defaultMode.name() : null;
        this.updatedBy = updatedBy;
        markSectionCompleted("mode");
    }

    public void updateAutomation(Boolean autoEvalEnabled, Long updatedBy) {
        this.autoEvalEnabled = autoEvalEnabled;
        this.updatedBy = updatedBy;
        markSectionCompleted("automation");
    }

    public RubricTemplateCode rubricTemplateCode() {
        return rubricTemplateCode != null ? RubricTemplateCode.valueOf(rubricTemplateCode) : null;
    }

    public EvalMode defaultMode() {
        return defaultMode != null ? EvalMode.valueOf(defaultMode) : null;
    }

    public boolean isSectionCompleted(String section) {
        if (completedSectionsJson == null) {
            return false;
        }
        return Boolean.TRUE.equals(completedSectionsJson.get(section));
    }

    private void markSectionCompleted(String section) {
        if (completedSectionsJson == null) {
            completedSectionsJson = new HashMap<>();
        }
        completedSectionsJson.put(section, true);
    }

    public Prompt getPrompt() {
        return prompt;
    }

    public Long getDatasetId() {
        return datasetId;
    }

    public Map<String, Object> getRubricOverridesJson() {
        return rubricOverridesJson;
    }

    public Map<String, Object> getCriteriaAnchorsJson() {
        return criteriaAnchorsJson;
    }

    public Boolean getAutoEvalEnabled() {
        return autoEvalEnabled;
    }

    public Map<String, Boolean> getCompletedSectionsJson() {
        return completedSectionsJson;
    }

    public Long getUpdatedBy() {
        return updatedBy;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
