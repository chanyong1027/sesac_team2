package com.llm_ops.demo.budget.dto;

import com.llm_ops.demo.budget.domain.BudgetSoftAction;
import jakarta.validation.constraints.Min;
import java.math.BigDecimal;
import java.util.Map;

public record BudgetPolicyUpdateRequest(
    BigDecimal monthLimitUsd,
    BigDecimal softLimitUsd,
    BudgetSoftAction softAction,
    Map<String, String> degradeProviderModelMap,
    @Min(1) Integer degradeMaxOutputTokens,
    Boolean degradeDisableRag,
    Boolean enabled
) {
}

