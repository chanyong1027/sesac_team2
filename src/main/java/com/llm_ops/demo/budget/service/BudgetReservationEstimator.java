package com.llm_ops.demo.budget.service;

import com.knuddels.jtokkit.Encodings;
import com.knuddels.jtokkit.api.Encoding;
import com.knuddels.jtokkit.api.EncodingRegistry;
import com.knuddels.jtokkit.api.EncodingType;
import com.llm_ops.demo.budget.config.BudgetReservationEstimationProperties;
import com.llm_ops.demo.gateway.pricing.ModelPricing;
import java.math.BigDecimal;
import java.math.RoundingMode;
import org.springframework.stereotype.Service;

@Service
public class BudgetReservationEstimator {

    public static final String PRICING_UNAVAILABLE_REASON = "BUDGET_PRICING_UNAVAILABLE";

    private final BudgetReservationEstimationProperties properties;
    private final EncodingRegistry registry = Encodings.newLazyEncodingRegistry();
    private final Encoding encoding = registry.getEncoding(EncodingType.CL100K_BASE);

    public BudgetReservationEstimator(BudgetReservationEstimationProperties properties) {
        this.properties = properties;
    }

    public BudgetReservationEstimate estimate(
        String pricingModel,
        String systemPrompt,
        String userPrompt,
        Integer effectiveMaxTokens
    ) {
        if (pricingModel == null || pricingModel.isBlank() || !ModelPricing.isKnownModel(pricingModel)) {
            return BudgetReservationEstimate.unavailable(pricingModel, PRICING_UNAVAILABLE_REASON);
        }

        int reservedInputTokens = estimateInputTokenUpperBound(systemPrompt, userPrompt);
        int reservedOutputTokens = resolveOutputTokenUpperBound(effectiveMaxTokens);
        BigDecimal reserveAmountUsd = ModelPricing.calculateCost(pricingModel, reservedInputTokens, reservedOutputTokens);

        return BudgetReservationEstimate.reservable(
            pricingModel,
            reservedInputTokens,
            reservedOutputTokens,
            reserveAmountUsd
        );
    }

    int estimateInputTokenUpperBound(String systemPrompt, String userPrompt) {
        long rawInputTokens = (long) countTokens(systemPrompt) + countTokens(userPrompt);
        if (rawInputTokens <= 0L) {
            return 0;
        }

        BigDecimal scaled = BigDecimal.valueOf(rawInputTokens)
            .multiply(properties.resolvedInputTokenSafetyMultiplier())
            .setScale(0, RoundingMode.CEILING);

        if (scaled.compareTo(BigDecimal.valueOf(Integer.MAX_VALUE)) > 0) {
            return Integer.MAX_VALUE;
        }
        return scaled.intValueExact();
    }

    int resolveOutputTokenUpperBound(Integer effectiveMaxTokens) {
        if (effectiveMaxTokens != null && effectiveMaxTokens > 0) {
            return effectiveMaxTokens;
        }
        return properties.resolvedDefaultMaxOutputTokens();
    }

    private int countTokens(String text) {
        if (text == null || text.isBlank()) {
            return 0;
        }
        return encoding.countTokens(text);
    }
}
