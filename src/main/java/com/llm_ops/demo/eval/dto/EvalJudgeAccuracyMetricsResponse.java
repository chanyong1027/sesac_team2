package com.llm_ops.demo.eval.dto;

public record EvalJudgeAccuracyMetricsResponse(
        long reviewedCount,
        long correctCount,
        long incorrectCount,
        double accuracy,
        double overrideRate,
        ConfusionMatrix confusionMatrix,
        String note
) {

    public record ConfusionMatrix(
            long tp,
            long tn,
            long fp,
            long fn,
            double precision,
            double recall,
            double f1,
            double balancedAccuracy
    ) {
    }
}
