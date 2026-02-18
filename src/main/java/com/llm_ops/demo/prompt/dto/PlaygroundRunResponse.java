package com.llm_ops.demo.prompt.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record PlaygroundRunResponse(
    String traceId,
    String answer,
    String usedModel,
    PlaygroundUsage usage,
    Integer latencyMs,
    LocalDateTime executedAt
) {
    public record PlaygroundUsage(
        Integer inputTokens,
        Integer outputTokens,
        Integer totalTokens,
        BigDecimal estimatedCost
    ) {}
}
