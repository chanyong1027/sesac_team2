package com.llm_ops.demo.eval.dto;

import java.math.BigDecimal;
import java.util.Map;

public record EvalRunEstimateResponse(
        int estimatedCases,
        long estimatedCallsMin,
        long estimatedCallsMax,
        long estimatedTokensMin,
        long estimatedTokensMax,
        BigDecimal estimatedCostUsdMin,
        BigDecimal estimatedCostUsdMax,
        String estimatedCostTier,
        double estimatedDurationSecMin,
        double estimatedDurationSecMax,
        String estimateNotice,
        Map<String, Object> assumptions
) {
}
