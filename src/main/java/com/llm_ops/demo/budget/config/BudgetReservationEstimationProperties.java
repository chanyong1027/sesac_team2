package com.llm_ops.demo.budget.config;

import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "budget.reservation")
@Getter
@Setter
public class BudgetReservationEstimationProperties {

    private static final int DEFAULT_MAX_OUTPUT_TOKENS = 2048;
    private static final BigDecimal DEFAULT_INPUT_TOKEN_SAFETY_MULTIPLIER = new BigDecimal("1.10");

    private int defaultMaxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS;
    private BigDecimal inputTokenSafetyMultiplier = DEFAULT_INPUT_TOKEN_SAFETY_MULTIPLIER;

    public int resolvedDefaultMaxOutputTokens() {
        return defaultMaxOutputTokens > 0 ? defaultMaxOutputTokens : DEFAULT_MAX_OUTPUT_TOKENS;
    }

    public BigDecimal resolvedInputTokenSafetyMultiplier() {
        if (inputTokenSafetyMultiplier == null || inputTokenSafetyMultiplier.compareTo(BigDecimal.ONE) < 0) {
            return DEFAULT_INPUT_TOKEN_SAFETY_MULTIPLIER;
        }
        return inputTokenSafetyMultiplier;
    }
}
