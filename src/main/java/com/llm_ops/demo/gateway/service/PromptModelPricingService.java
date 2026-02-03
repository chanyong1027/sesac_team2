package com.llm_ops.demo.gateway.service;

import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.prompt.config.PromptPricingProperties;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class PromptModelPricingService {

    private static final BigDecimal THOUSAND = new BigDecimal("1000");

    private final PromptPricingProperties properties;

    public PromptModelPricingService(PromptPricingProperties properties) {
        this.properties = properties;
    }

    public PricingResult calculate(ProviderType providerType, String model, Long promptTokens, Long completionTokens, Long totalTokens) {
        if (providerType == null || model == null || model.isBlank()) {
            return null;
        }
        PromptPricingProperties.Pricing pricing = resolvePricing(providerType, model);
        if (pricing == null || pricing.getInput() == null || pricing.getOutput() == null) {
            return null;
        }
        if (isZero(pricing.getInput()) && isZero(pricing.getOutput())) {
            return null;
        }

        long prompt = promptTokens != null ? promptTokens : 0L;
        long completion = completionTokens != null ? completionTokens : 0L;
        if (prompt == 0L && completion == 0L && totalTokens != null) {
            prompt = totalTokens;
        }

        BigDecimal promptCost = new BigDecimal(prompt).divide(THOUSAND, 10, RoundingMode.HALF_UP)
                .multiply(pricing.getInput());
        BigDecimal completionCost = new BigDecimal(completion).divide(THOUSAND, 10, RoundingMode.HALF_UP)
                .multiply(pricing.getOutput());
        BigDecimal totalCost = promptCost.add(completionCost).setScale(8, RoundingMode.HALF_UP);

        return new PricingResult(totalCost, properties.getCurrency(), properties.getVersion());
    }

    private PromptPricingProperties.Pricing resolvePricing(ProviderType providerType, String model) {
        Map<String, Map<String, PromptPricingProperties.Pricing>> providers = properties.getProviders();
        if (providers == null || providers.isEmpty()) {
            return null;
        }
        Map<String, PromptPricingProperties.Pricing> models = providers.get(normalize(providerType.getValue()));
        if (models == null || models.isEmpty()) {
            return null;
        }
        return models.get(normalize(model));
    }

    private String normalize(String value) {
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private boolean isZero(BigDecimal value) {
        return value == null || value.compareTo(BigDecimal.ZERO) == 0;
    }

    public record PricingResult(BigDecimal estimatedCost, String currency, String pricingVersion) {
    }
}
