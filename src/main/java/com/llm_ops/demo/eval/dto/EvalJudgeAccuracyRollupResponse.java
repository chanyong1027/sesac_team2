package com.llm_ops.demo.eval.dto;

import java.time.LocalDateTime;

public record EvalJudgeAccuracyRollupResponse(
        Long promptId,
        Long promptVersionId,
        LocalDateTime from,
        LocalDateTime to,
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
