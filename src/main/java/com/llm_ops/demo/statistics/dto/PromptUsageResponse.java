package com.llm_ops.demo.statistics.dto;

import java.math.BigDecimal;
import java.util.List;

public record PromptUsageResponse(
        List<PromptUsageItem> prompts
) {
    public record PromptUsageItem(
            Long promptId,
            String promptName,
            String promptKey,
            Long requests,
            Long tokens,
            BigDecimal cost
    ) {
    }
}
