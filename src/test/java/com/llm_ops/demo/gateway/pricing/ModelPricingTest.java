package com.llm_ops.demo.gateway.pricing;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class ModelPricingTest {

    @Test
    void calculateCostFromTotalTokens_knownModel_returnsPositiveCost() {
        BigDecimal cost = ModelPricing.calculateCostFromTotalTokens("gpt-4o-mini", 1000);
        assertThat(cost).isGreaterThan(BigDecimal.ZERO);
    }

    @Test
    void calculateCost_gpt4turboAlias_isNotZero() {
        BigDecimal cost = ModelPricing.calculateCost("gpt-4-turbo-2024-04-09", 1000, 1000);
        assertThat(cost).isGreaterThan(BigDecimal.ZERO);
    }

    @Test
    void calculateCost_gemini25Flash_isNotZero() {
        BigDecimal cost = ModelPricing.calculateCost("gemini-2.5-flash", 1000, 1000);
        assertThat(cost).isGreaterThan(BigDecimal.ZERO);
    }
}

