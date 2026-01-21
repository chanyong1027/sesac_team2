package com.llm_ops.demo.gateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
@ConfigurationProperties(prefix = "gateway")
public class GatewayPromptProviderProperties {

    private List<PromptProviderMapping> promptProviders = new ArrayList<>();

    public List<PromptProviderMapping> getPromptProviders() {
        return promptProviders;
    }

    public void setPromptProviders(List<PromptProviderMapping> promptProviders) {
        this.promptProviders = promptProviders;
    }

    public static class PromptProviderMapping {
        private String promptKey;
        private String provider;

        public String getPromptKey() {
            return promptKey;
        }

        public void setPromptKey(String promptKey) {
            this.promptKey = promptKey;
        }

        public String getProvider() {
            return provider;
        }

        public void setProvider(String provider) {
            this.provider = provider;
        }
    }
}
