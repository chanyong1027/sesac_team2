package com.llm_ops.demo.eval.dto;

public record EvalJudgeAccuracyMetricsResponse(
        Long runId,
        long totalCases,
        long reviewedCount,
        long correctCount,
        long incorrectCount,
        Double accuracy,
        Double overrideRate,
        long tp,
        long tn,
        long fp,
        long fn,
        Double precision,
        Double recall,
        Double f1,
        Double specificity,
        Double balancedAccuracy,
        String note
) {
}
