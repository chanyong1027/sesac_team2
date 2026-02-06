package com.llm_ops.demo.rag.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * OpenAI 임베딩 설정을 외부 프로퍼티로부터 바인딩합니다.
 * 'rag.embedding.openai' 프리픽스로 시작하는 설정을 매핑합니다.
 */
@Component
@ConfigurationProperties(prefix = "rag.embedding.openai")
@Getter
@Setter
public class RagEmbeddingOpenAiProperties {

    /**
     * OpenAI 임베딩 사용 여부입니다.
     */
    private boolean enabled = false;

    /**
     * OpenAI API 키입니다.
     */
    private String apiKey;

    /**
     * OpenAI API Base URL (선택 사항).
     */
    private String baseUrl;

    /**
     * 사용할 임베딩 모델명입니다.
     */
    private String model = "text-embedding-3-small";

    /**
     * 임베딩 차원 수 (선택).
     */
    private Integer dimensions = 1536;
}
