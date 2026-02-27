package com.llm_ops.demo.gateway.pricing;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class ModelPricingTest {

    @Test
    void calculateCostFromTotalTokens_knownModel_returnsPositiveCost() {
        BigDecimal cost = ModelPricing.calculateCostFromTotalTokens("gpt-4.1-mini", 1000);
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

    @Test
    void isKnownModel_supportsPromptModelAllowlist() {
        // prompt.model-allowlist (application.yml) 에 등록된 모델은 비용 인식이 가능해야 한다.
        List<String> allowlistModels = List.of(
                // OpenAI
                "gpt-5.2",
                "gpt-4.1",
                "gpt-4.1-mini",
                "o3",
                "o4-mini",
                // Anthropic
                "claude-opus-4-6",
                "claude-sonnet-4-6",
                "claude-haiku-4-5",
                // Google Gemini
                "gemini-2.5-pro",
                "gemini-2.5-flash",
                "gemini-2.5-flash-lite"
        );

        assertThat(allowlistModels)
                .allMatch(ModelPricing::isKnownModel);
    }

    @Test
    void calculateCost_gpt41MiniVersionedModel_isNotZero() {
        BigDecimal cost = ModelPricing.calculateCost("gpt-4.1-mini-2025-04-14", 1000, 1000);
        assertThat(cost).isGreaterThan(BigDecimal.ZERO);
    }
}
