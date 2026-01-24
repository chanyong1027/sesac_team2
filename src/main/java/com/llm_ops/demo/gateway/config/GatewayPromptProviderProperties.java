package com.llm_ops.demo.gateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * 게이트웨이에서 특정 프롬프트 키와 LLM 프로바이더를 매핑하는 설정을 외부 프로퍼티로부터 바인딩하는 클래스입니다.
 * 이를 통해 들어오는 promptKey에 따라 동적으로 사용할 LLM 프로바이더를 결정할 수 있습니다.
 */
@ConfigurationProperties(prefix = "gateway")
public record GatewayPromptProviderProperties(List<PromptProviderMapping> promptProviders) {

    /**
     * 특정 promptKey와 해당 prompt를 처리할 LLM 프로바이더를 정의하는 내부 record입니다.
     */
    public record PromptProviderMapping(String promptKey, String provider) {
    }
}
