package com.llm_ops.demo.gateway.log.dto.projection;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 시계열 데이터 집계 결과
 */
public interface TimeseriesDataProjection {
    LocalDate getDate();
    Long getRequests();
    Long getTokens();
    BigDecimal getCost();
}
