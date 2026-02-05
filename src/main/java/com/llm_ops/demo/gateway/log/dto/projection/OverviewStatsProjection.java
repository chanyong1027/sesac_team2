package com.llm_ops.demo.gateway.log.dto.projection;

import java.math.BigDecimal;

/**
 * Overview 통계 집계 결과
 */
public interface OverviewStatsProjection {
    Long getTotalRequests();
    Long getSuccessCount();
    Long getErrorCount();
    Long getTotalTokens();
    Integer getAvgLatencyMs();
    Integer getP95LatencyMs();
    Integer getP99LatencyMs();
    BigDecimal getTotalCost();
}
