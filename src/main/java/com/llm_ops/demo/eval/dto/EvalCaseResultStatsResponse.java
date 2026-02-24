package com.llm_ops.demo.eval.dto;

import java.util.Map;

public record EvalCaseResultStatsResponse(
        long queuedCount,
        long runningCount,
        long okCount,
        long errorCount,
        long passTrueCount,
        long passFalseCount,
        long effectivePassTrueCount,
        long effectivePassFalseCount,
        long humanUnreviewedCount,
        long humanCorrectCount,
        long humanIncorrectCount,
        Map<String, Long> topLabelCounts
) {
}
