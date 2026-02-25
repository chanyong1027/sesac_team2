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
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "prompt_eval_defaults")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PromptEvalDefault {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prompt_id", nullable = false)
    private Prompt prompt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dataset_id")
    private EvalDataset dataset;

    @Column(name = "rubric_template_code", nullable = false, length = 50)
    private String rubricTemplateCode;

    @Column(name = "rubric_overrides_json")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> rubricOverridesJson;

    @Column(name = "criteria_anchors_json", nullable = false)
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> criteriaAnchorsJson;

    @Column(name = "default_mode", nullable = false, length = 30)
    private String defaultMode;

    @Column(name = "auto_eval_enabled", nullable = false)
    private boolean autoEvalEnabled;

    @Column(name = "updated_by", nullable = false)
    private Long updatedBy;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public static PromptEvalDefault create(
            Prompt prompt,
            EvalDataset dataset,
            RubricTemplateCode rubricTemplateCode,
            Map<String, Object> rubricOverridesJson,
            Map<String, Object> criteriaAnchorsJson,
            EvalMode defaultMode,
            boolean autoEvalEnabled,
            Long updatedBy
    ) {
        PromptEvalDefault value = new PromptEvalDefault();
        value.prompt = prompt;
        value.dataset = dataset;
        value.rubricTemplateCode = rubricTemplateCode.name();
        value.rubricOverridesJson = rubricOverridesJson;
        value.criteriaAnchorsJson = criteriaAnchorsJson != null ? criteriaAnchorsJson : new HashMap<>();
        value.defaultMode = defaultMode.name();
        value.autoEvalEnabled = autoEvalEnabled;
        value.updatedBy = updatedBy;
        return value;
    }

    public void update(
            EvalDataset dataset,
            RubricTemplateCode rubricTemplateCode,
            Map<String, Object> rubricOverridesJson,
            Map<String, Object> criteriaAnchorsJson,
            EvalMode defaultMode,
            boolean autoEvalEnabled,
            Long updatedBy
    ) {
        this.dataset = dataset;
        this.rubricTemplateCode = rubricTemplateCode.name();
        this.rubricOverridesJson = rubricOverridesJson;
        if (criteriaAnchorsJson != null) {
            this.criteriaAnchorsJson = criteriaAnchorsJson;
        } else if (this.criteriaAnchorsJson == null) {
            this.criteriaAnchorsJson = new HashMap<>();
        }
        this.defaultMode = defaultMode.name();
        this.autoEvalEnabled = autoEvalEnabled;
        this.updatedBy = updatedBy;
    }

    public Prompt getPrompt() {
        return prompt;
    }

    public EvalDataset getDataset() {
        return dataset;
    }

    public Map<String, Object> getRubricOverridesJson() {
        if (criteriaAnchorsJson == null || criteriaAnchorsJson.isEmpty()) {
            return rubricOverridesJson;
        }
        Map<String, Object> merged = rubricOverridesJson != null ? new LinkedHashMap<>(rubricOverridesJson) : new LinkedHashMap<>();
        merged.putIfAbsent("criteriaAnchors", criteriaAnchorsJson);
        return merged;
    }

    public Map<String, Object> getCriteriaAnchorsJson() {
        return criteriaAnchorsJson;
    }

    public boolean isAutoEvalEnabled() {
        return autoEvalEnabled;
    }

    public Long getUpdatedBy() {
        return updatedBy;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public RubricTemplateCode rubricTemplateCode() {
        return RubricTemplateCode.valueOf(rubricTemplateCode);
    }

    public EvalMode defaultMode() {
        return EvalMode.valueOf(defaultMode);
    }
}
