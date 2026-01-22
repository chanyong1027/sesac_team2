package com.llm_ops.demo.gateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * 게이트웨이에서 특정 프롬프트 키와 LLM 프로바이더를 매핑하는 설정을 외부 프로퍼티로부터 바인딩하는 클래스입니다.
 * 이를 통해 들어오는 promptKey에 따라 동적으로 사용할 LLM 프로바이더를 결정할 수 있습니다.
 */
@Component
@ConfigurationProperties(prefix = "gateway")
public class GatewayPromptProviderProperties {

    private List<PromptProviderMapping> promptProviders = new ArrayList<>();

    /**
     * 프롬프트-프로바이더 매핑 리스트를 반환합니다.
     * @return PromptProviderMapping 리스트
     */
    public List<PromptProviderMapping> getPromptProviders() {
        return promptProviders;
    }

    /**
     * 프롬프트-프로바이더 매핑 리스트를 설정합니다.
     * @param promptProviders PromptProviderMapping 리스트
     */
    public void setPromptProviders(List<PromptProviderMapping> promptProviders) {
        this.promptProviders = promptProviders;
    }

    /**
     * 특정 promptKey와 해당 prompt를 처리할 LLM 프로바이더를 정의하는 내부 클래스입니다.
     */
    public static class PromptProviderMapping {
        private String promptKey;
        private String provider;

        /**
         * 프롬프트 키를 반환합니다.
         * @return 프롬프트 키
         */
        public String getPromptKey() {
            return promptKey;
        }

        /**
         * 프롬프트 키를 설정합니다.
         * @param promptKey 프롬프트 키
         */
        public void setPromptKey(String promptKey) {
            this.promptKey = promptKey;
        }

        /**
         * LLM 프로바이더 이름을 반환합니다.
         * @return 프로바이더 이름
         */
        public String getProvider() {
            return provider;
        }

        /**
         * LLM 프로바이더 이름을 설정합니다.
         * @param provider 프로바이더 이름
         */
        public void setProvider(String provider) {
            this.provider = provider;
        }
    }
}
