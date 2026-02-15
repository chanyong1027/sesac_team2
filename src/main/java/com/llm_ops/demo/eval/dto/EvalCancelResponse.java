package com.llm_ops.demo.eval.dto;

public record EvalCancelResponse(
        Long runId,
        String status
) {
}
