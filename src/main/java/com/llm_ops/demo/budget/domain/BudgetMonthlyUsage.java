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
    name = "budget_monthly_usage",
    uniqueConstraints = @UniqueConstraint(columnNames = {"scope_type", "scope_id", "year_month"})
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BudgetMonthlyUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "scope_type", nullable = false, length = 32)
    private BudgetScopeType scopeType;

    @Column(name = "scope_id", nullable = false)
    private Long scopeId;

    @Column(name = "year_month", nullable = false)
    private Integer yearMonth;

    @Column(name = "cost_usd", nullable = false, precision = 18, scale = 8)
    private BigDecimal costUsd;

    @Column(name = "total_tokens", nullable = false)
    private Long totalTokens;

    @Column(name = "request_count", nullable = false)
    private Long requestCount;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public static BudgetMonthlyUsage create(BudgetScopeType scopeType, Long scopeId, Integer yearMonth) {
        BudgetMonthlyUsage usage = new BudgetMonthlyUsage();
        usage.scopeType = scopeType;
        usage.scopeId = scopeId;
        usage.yearMonth = yearMonth;
        usage.costUsd = BigDecimal.ZERO;
        usage.totalTokens = 0L;
        usage.requestCount = 0L;
        return usage;
    }

    public void addUsage(BigDecimal costDelta, Long tokensDelta, long requestDelta) {
        BigDecimal normalizedCost = costDelta != null ? costDelta : BigDecimal.ZERO;
        long normalizedTokens = tokensDelta != null ? tokensDelta : 0L;
        this.costUsd = (this.costUsd != null ? this.costUsd : BigDecimal.ZERO).add(normalizedCost);
        this.totalTokens = (this.totalTokens != null ? this.totalTokens : 0L) + normalizedTokens;
        this.requestCount = (this.requestCount != null ? this.requestCount : 0L) + requestDelta;
    }
}

