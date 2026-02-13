package com.llm_ops.demo.gateway.log.dto;

import com.llm_ops.demo.gateway.log.domain.RequestLogStatus;
import java.time.LocalDateTime;

/**
 * 로그 목록 조회 시 검색 조건
 */
public record RequestLogSearchCondition(
        LocalDateTime from,
        LocalDateTime to,
        RequestLogStatus status,
        Boolean failover,
        String provider,
        String usedModel,
        Boolean ragEnabled,
        String promptKey,
        String traceId,
        String errorCode,
        String requestSource) {
    public static RequestLogSearchCondition empty() {
        return new RequestLogSearchCondition(null, null, null, null, null, null, null, null, null, null, null);
    }
}
