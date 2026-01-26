package com.llm_ops.demo.rag.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * RAG(Retrieval-Augmented Generation) 파이프라인에서 사용될
 * Google GenAI 임베딩 모델의 설정을 외부 프로퍼티로부터 바인딩하는 클래스입니다.
 * 'rag.embedding.google-genai' 프리픽스로 시작하는 설정을 매핑합니다.
 */
@Component
@ConfigurationProperties(prefix = "rag.embedding.google-genai")
@Getter
@Setter
public class RagEmbeddingProperties {

    /**
     * Google GenAI 임베딩 기능 사용 여부입니다.
     */
    private boolean enabled = false;

    /**
     * Google GenAI API 키입니다.
     */
    private String apiKey;

    /**
     * 사용할 임베딩 모델명입니다 (기본값: "text-embedding-004").
     */
    private String model = "text-embedding-004";

    /**
     * 임베딩 벡터의 출력 차원 수입니다.
     * (예: 768, 1536 등. 모델에 따라 다름)
     */
    private Integer outputDimensionality;

}
