package com.llm_ops.demo.statistics.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record TimeseriesResponse(
                List<TimeseriesDataPoint> data) {
        public record TimeseriesDataPoint(
                        LocalDate date,
                        Long requests,
                        Long errorCount,
                        Long tokens,
                        BigDecimal cost) {
        }
}
