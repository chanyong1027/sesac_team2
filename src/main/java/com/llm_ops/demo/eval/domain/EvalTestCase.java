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
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "eval_test_cases")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EvalTestCase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dataset_id", nullable = false)
    private EvalDataset dataset;

    @Column(name = "case_order", nullable = false)
    private Integer caseOrder;

    @Column(name = "external_id", length = 120)
    private String externalId;

    @Column(name = "input_text", nullable = false, columnDefinition = "TEXT")
    private String inputText;

    @Column(name = "context_json")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> contextJson;

    @Column(name = "expected_json")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> expectedJson;

    @Column(name = "constraints_json")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> constraintsJson;

    @Column(nullable = false)
    private boolean enabled;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public static EvalTestCase create(
            EvalDataset dataset,
            Integer caseOrder,
            String externalId,
            String inputText,
            Map<String, Object> contextJson,
            Map<String, Object> expectedJson,
            Map<String, Object> constraintsJson
    ) {
        EvalTestCase testCase = new EvalTestCase();
        testCase.dataset = dataset;
        testCase.caseOrder = caseOrder;
        testCase.externalId = externalId;
        testCase.inputText = inputText;
        testCase.contextJson = contextJson;
        testCase.expectedJson = expectedJson;
        testCase.constraintsJson = constraintsJson;
        testCase.enabled = true;
        return testCase;
    }
}
