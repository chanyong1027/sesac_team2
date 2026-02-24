package com.llm_ops.demo.eval.dto;

import java.time.LocalDateTime;

public record EvalJudgeAccuracyRollupResponse(
        Long promptId,
        Long promptVersionId,
        LocalDateTime from,
        LocalDateTime to,
        EvalJudgeAccuracyMetricsResponse metrics
) {
}
