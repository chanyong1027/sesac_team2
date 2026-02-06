package com.llm_ops.demo.budget.service;

import com.llm_ops.demo.budget.domain.BudgetScopeType;

/**
 * 예산 평가 결과.
 * - BLOCK: 요청 차단
 * - DEGRADE: 요청은 진행하되 모델/옵션을 강제로 낮춤
 * - ALLOW: 그대로 진행
 */
public record BudgetDecision(
    BudgetDecisionAction action,
    BudgetScopeType scopeType,
    Long scopeId,
    String reason,
    Overrides overrides
) {
    public record Overrides(
        String modelOverride,
        Integer maxOutputTokens,
        Boolean disableRag
    ) {
    }

    public static BudgetDecision allow() {
        return new BudgetDecision(BudgetDecisionAction.ALLOW, null, null, null, new Overrides(null, null, null));
    }
}

