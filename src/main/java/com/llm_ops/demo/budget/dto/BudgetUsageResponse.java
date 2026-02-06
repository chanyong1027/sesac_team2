package com.llm_ops.demo.budget.dto;

import com.llm_ops.demo.budget.domain.BudgetScopeType;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public record BudgetUsageResponse(
    BudgetScopeType scopeType,
    Long scopeId,
    String month, // YYYY-MM (UTC)
    BigDecimal usedUsd,
    BigDecimal hardLimitUsd,
    BigDecimal softLimitUsd,
    BigDecimal remainingHardUsd,
    BigDecimal remainingSoftUsd,
    Long requestCount,
    Long totalTokens,
    LocalDateTime lastUpdatedAt
) {
}

