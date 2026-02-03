package com.llm_ops.demo.prompt.config;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "prompt.pricing")
public class PromptPricingProperties {

    private String version = "unpriced";
    private String currency = "USD";
    private Map<String, Map<String, Pricing>> providers = new LinkedHashMap<>();

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public Map<String, Map<String, Pricing>> getProviders() {
        return providers;
    }

    public void setProviders(Map<String, Map<String, Pricing>> providers) {
        this.providers = providers;
    }

    public static class Pricing {
        private BigDecimal input;
        private BigDecimal output;

        public BigDecimal getInput() {
            return input;
        }

        public void setInput(BigDecimal input) {
            this.input = input;
        }

        public BigDecimal getOutput() {
            return output;
        }

        public void setOutput(BigDecimal output) {
            this.output = output;
        }
    }
}
