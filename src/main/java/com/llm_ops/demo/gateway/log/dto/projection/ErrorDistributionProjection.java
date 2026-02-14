package com.llm_ops.demo.gateway.log.dto.projection;

/**
 * 에러 분포 집계 결과
 */
public interface ErrorDistributionProjection {
    String getStatus();

    String getErrorCode();

    String getFailReason();

    Long getCount();
}
