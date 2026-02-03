package com.llm_ops.demo.statistics.dto;

import java.math.BigDecimal;
import java.util.List;

public record PromptUsageResponse(
        List<PromptUsageItem> prompts
) {
    public record PromptUsageItem(
            Long id,
            String name,
            String key,
            Long requests,
            Long tokens,
            BigDecimal cost
    ) {
    }
}
