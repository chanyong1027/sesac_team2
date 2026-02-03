package com.llm_ops.demo.gateway.log.dto.projection;

import java.math.BigDecimal;

/**
 * 프롬프트별 사용량 집계 결과
 */
public interface PromptUsageProjection {
    Long getPromptId();
    String getPromptKey();
    Long getRequests();
    Long getTokens();
    BigDecimal getCost();
}
