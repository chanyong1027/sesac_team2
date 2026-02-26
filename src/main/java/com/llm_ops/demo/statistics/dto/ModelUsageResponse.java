package com.llm_ops.demo.statistics.dto;

import java.math.BigDecimal;
import java.util.List;

public record ModelUsageResponse(
                List<ModelUsageItem> models) {
        public record ModelUsageItem(
                        String provider,
                        String modelName,
                        Long requests,
                        Long tokens,
                        BigDecimal cost,
                        Double percentage,
                        Integer avgLatencyMs) {
        }
}
