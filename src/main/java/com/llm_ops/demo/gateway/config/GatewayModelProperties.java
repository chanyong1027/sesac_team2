package com.llm_ops.demo.gateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "gateway")
public class GatewayModelProperties {

    private Models models = new Models();

    public Models getModels() {
        return models;
    }

    public void setModels(Models models) {
        this.models = models;
    }

    public static class Models {
        private String openai;
        private String anthropic;
        private String gemini;

        public String getOpenai() {
            return openai;
        }

        public void setOpenai(String openai) {
            this.openai = openai;
        }

        public String getAnthropic() {
            return anthropic;
        }

        public void setAnthropic(String anthropic) {
            this.anthropic = anthropic;
        }

        public String getGemini() {
            return gemini;
        }

        public void setGemini(String gemini) {
            this.gemini = gemini;
        }
    }
}
