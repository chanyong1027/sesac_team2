package com.llm_ops.demo.gateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 게이트웨이에서 사용할 LLM 모델 설정을 외부 프로퍼티로부터 바인딩하는 클래스입니다.
 * application.yml 또는 application.properties 파일에서 'gateway' 프리픽스로 시작하는 설정을 매핑합니다.
 */
@Component
@ConfigurationProperties(prefix = "gateway")
public class GatewayModelProperties {

    private Models models = new Models();

    /**
     * 모델 설정을 반환합니다.
     * @return Models 객체
     */
    public Models getModels() {
        return models;
    }

    /**
     * 모델 설정을 설정합니다.
     * @param models Models 객체
     */
    public void setModels(Models models) {
        this.models = models;
    }

    /**
     * 각 LLM 프로바이더별 모델 이름을 담는 내부 클래스입니다.
     */
    public static class Models {
        private String openai;
        private String anthropic;
        private String gemini;

        /**
         * OpenAI 모델 이름을 반환합니다.
         * @return OpenAI 모델 이름
         */
        public String getOpenai() {
            return openai;
        }

        /**
         * OpenAI 모델 이름을 설정합니다.
         * @param openai OpenAI 모델 이름
         */
        public void setOpenai(String openai) {
            this.openai = openai;
        }

        /**
         * Anthropic 모델 이름을 반환합니다.
         * @return Anthropic 모델 이름
         */
        public String getAnthropic() {
            return anthropic;
        }

        /**
         * Anthropic 모델 이름을 설정합니다.
         * @param anthropic Anthropic 모델 이름
         */
        public void setAnthropic(String anthropic) {
            this.anthropic = anthropic;
        }

        /**
         * Gemini 모델 이름을 반환합니다.
         * @return Gemini 모델 이름
         */
        public String getGemini() {
            return gemini;
        }

        /**
         * Gemini 모델 이름을 설정합니다.
         * @param gemini Gemini 모델 이름
         */
        public void setGemini(String gemini) {
            this.gemini = gemini;
        }
    }
}
