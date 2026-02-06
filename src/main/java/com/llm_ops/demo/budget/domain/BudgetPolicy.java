package com.llm_ops.demo.budget.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(
    name = "budget_policies",
    uniqueConstraints = @UniqueConstraint(columnNames = {"scope_type", "scope_id"})
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BudgetPolicy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "scope_type", nullable = false, length = 32)
    private BudgetScopeType scopeType;

    @Column(name = "scope_id", nullable = false)
    private Long scopeId;

    @Column(name = "month_limit_usd", precision = 18, scale = 8)
    private BigDecimal monthLimitUsd;

    @Column(name = "soft_limit_usd", precision = 18, scale = 8)
    private BigDecimal softLimitUsd;

    @Enumerated(EnumType.STRING)
    @Column(name = "soft_action", nullable = false, length = 32)
    private BudgetSoftAction softAction;

    /**
     * provider별 cheap model 매핑 JSON 문자열.
     * (v1) JPA/H2 호환성을 위해 TEXT로 저장하고 서비스 레이어에서 파싱합니다.
     */
    @Column(name = "degrade_provider_model_map", nullable = false, columnDefinition = "TEXT")
    private String degradeProviderModelMap;

    @Column(name = "degrade_max_output_tokens", nullable = false)
    private Integer degradeMaxOutputTokens;

    @Column(name = "degrade_disable_rag", nullable = false)
    private Boolean degradeDisableRag;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public static BudgetPolicy createDefault(BudgetScopeType scopeType, Long scopeId) {
        BudgetPolicy policy = new BudgetPolicy();
        policy.scopeType = scopeType;
        policy.scopeId = scopeId;
        policy.monthLimitUsd = null;
        policy.softLimitUsd = null;
        policy.softAction = BudgetSoftAction.DEGRADE;
        policy.degradeProviderModelMap = "{}";
        policy.degradeMaxOutputTokens = 512;
        policy.degradeDisableRag = false;
        policy.enabled = true;
        return policy;
    }

    public void update(
        BigDecimal monthLimitUsd,
        BigDecimal softLimitUsd,
        BudgetSoftAction softAction,
        String degradeProviderModelMap,
        Integer degradeMaxOutputTokens,
        Boolean degradeDisableRag,
        Boolean enabled
    ) {
        this.monthLimitUsd = monthLimitUsd;
        this.softLimitUsd = softLimitUsd;
        this.softAction = softAction != null ? softAction : BudgetSoftAction.DEGRADE;
        this.degradeProviderModelMap = degradeProviderModelMap != null ? degradeProviderModelMap : "{}";
        this.degradeMaxOutputTokens = degradeMaxOutputTokens != null ? degradeMaxOutputTokens : 512;
        this.degradeDisableRag = degradeDisableRag != null ? degradeDisableRag : false;
        this.enabled = enabled != null ? enabled : Boolean.TRUE;
    }
}

