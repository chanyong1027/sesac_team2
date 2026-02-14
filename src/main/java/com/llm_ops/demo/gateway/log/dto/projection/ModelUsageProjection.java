package com.llm_ops.demo.gateway.log.dto.projection;

import java.math.BigDecimal;

/**
 * 모델별 사용량 집계 결과
 */
public interface ModelUsageProjection {
    String getProvider();

    String getModelName();

    Long getRequests();

    Long getTokens();

    BigDecimal getCost();

    Integer getAvgLatencyMs();
}
