package com.llm_ops.demo.budget.dto;

import com.llm_ops.demo.budget.domain.BudgetPolicy;
import com.llm_ops.demo.budget.domain.BudgetScopeType;
import com.llm_ops.demo.budget.domain.BudgetSoftAction;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

public record BudgetPolicyResponse(
    BudgetScopeType scopeType,
    Long scopeId,
    BigDecimal monthLimitUsd,
    BigDecimal softLimitUsd,
    BudgetSoftAction softAction,
    Map<String, String> degradeProviderModelMap,
    Integer degradeMaxOutputTokens,
    Boolean degradeDisableRag,
    Boolean enabled,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
    public static BudgetPolicyResponse from(BudgetPolicy policy, Map<String, String> degradeProviderModelMap) {
        return new BudgetPolicyResponse(
            policy.getScopeType(),
            policy.getScopeId(),
            policy.getMonthLimitUsd(),
            policy.getSoftLimitUsd(),
            policy.getSoftAction(),
            degradeProviderModelMap,
            policy.getDegradeMaxOutputTokens(),
            policy.getDegradeDisableRag(),
            policy.getEnabled(),
            policy.getCreatedAt(),
            policy.getUpdatedAt()
        );
    }
}

