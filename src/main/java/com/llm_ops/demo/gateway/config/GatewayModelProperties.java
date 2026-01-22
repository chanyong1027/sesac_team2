package com.llm_ops.demo.gateway.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 게이트웨이에서 사용할 LLM 모델 설정을 외부 프로퍼티로부터 바인딩하는 클래스입니다.
 * application.yml 또는 application.properties 파일에서 'gateway' 프리픽스로 시작하는 설정을 매핑합니다.
 */
@Component
@ConfigurationProperties(prefix = "gateway")
@Getter
@Setter
public class GatewayModelProperties {

    private Models models = new Models();

    /**
     * 각 LLM 프로바이더별 모델 이름을 담는 내부 클래스입니다.
     */
    @Getter
    @Setter
    public static class Models {
        private String openai;
        private String anthropic;
        private String gemini;
    }
}
