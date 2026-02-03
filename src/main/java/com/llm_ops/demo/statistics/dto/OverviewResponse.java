package com.llm_ops.demo.statistics.dto;

import java.math.BigDecimal;

public record OverviewResponse(
        Long totalRequests,
        Double requestsChange,
        Double successRate,
        Long errorCount,
        Long totalTokens,
        Double tokensChange,
        Integer avgLatencyMs,
        Integer p95LatencyMs,
        Integer p99LatencyMs,
        Double latencyChange,
        BigDecimal totalCost,
        Double costChange
) {
}
