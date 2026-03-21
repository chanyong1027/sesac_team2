package com.llm_ops.demo.budget.service;

import java.math.BigDecimal;

public record BudgetReservationEstimate(
    String pricingModel,
    Integer reservedInputTokens,
    Integer reservedOutputTokens,
    BigDecimal reserveAmountUsd,
    boolean reservable,
    String rejectionReason
) {
    public static BudgetReservationEstimate reservable(
        String pricingModel,
        Integer reservedInputTokens,
        Integer reservedOutputTokens,
        BigDecimal reserveAmountUsd
    ) {
        return new BudgetReservationEstimate(
            pricingModel,
            reservedInputTokens,
            reservedOutputTokens,
            reserveAmountUsd,
            true,
            null
        );
    }

    public static BudgetReservationEstimate unavailable(String pricingModel, String rejectionReason) {
        return new BudgetReservationEstimate(pricingModel, null, null, null, false, rejectionReason);
    }
}
