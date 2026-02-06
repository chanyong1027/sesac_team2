package com.llm_ops.demo.budget.domain;

/**
 * v1에서는 DEGRADE만 지원합니다.
 * (추후 v2에서 RAG OFF / TOKEN CAP / HARD BLOCK 등을 확장 가능)
 */
public enum BudgetSoftAction {
    DEGRADE
}

