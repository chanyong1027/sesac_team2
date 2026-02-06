package com.llm_ops.demo.rag.config;

import com.google.genai.Client;
import com.llm_ops.demo.rag.embedding.GoogleGenAiEmbeddingModel;
import org.springframework.ai.document.MetadataMode;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.openai.OpenAiEmbeddingModel;
import org.springframework.ai.openai.OpenAiEmbeddingOptions;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.util.StringUtils;

/**
 * Google GenAI 기반 임베딩 모델을 구성합니다.
 */
/**
 * RAG(Retrieval-Augmented Generation) 파이프라인에서 사용될 {@link GoogleGenAiEmbeddingModel} 빈을 구성하는 설정 클래스입니다.
 * Google GenAI 클라이언트를 활용하여 텍스트 임베딩을 생성하는 역할을 담당합니다.
 */
@Configuration
public class RagEmbeddingConfig {

    @Bean
    @Primary
    @ConditionalOnProperty(prefix = "rag.embedding.openai", name = "enabled", havingValue = "true")
    public EmbeddingModel ragOpenAiEmbeddingModel(RagEmbeddingOpenAiProperties properties) {
        if (!StringUtils.hasText(properties.getApiKey())) {
            throw new IllegalStateException("OpenAI embedding api-key가 필요합니다.");
        }

        OpenAiApi openAiApi = StringUtils.hasText(properties.getBaseUrl())
                ? new OpenAiApi(properties.getBaseUrl(), properties.getApiKey())
                : new OpenAiApi(properties.getApiKey());

        OpenAiEmbeddingOptions options = OpenAiEmbeddingOptions.builder()
                .model(properties.getModel())
                .dimensions(properties.getDimensions())
                .build();

        return new OpenAiEmbeddingModel(openAiApi, MetadataMode.EMBED, options);
    }

    /**
     * Google GenAI 기반 {@link EmbeddingModel} 빈을 생성합니다.
     * 'rag.embedding.google-genai.enabled' 속성이 'true'일 때만 활성화되며,
     * {@link EmbeddingModel} 인터페이스의 기본 구현체로 사용됩니다.
     *
     * @param properties 임베딩 모델 설정을 위한 {@link RagEmbeddingProperties}
     * @return GoogleGenAiEmbeddingModel 인스턴스
     * @throws IllegalStateException Google GenAI 임베딩 API 키가 설정되지 않은 경우
     */
    @Bean
    @ConditionalOnProperty(prefix = "rag.embedding.google-genai", name = "enabled", havingValue = "true") // 특정 프로퍼티 설정 시 활성화
    public EmbeddingModel googleGenAiEmbeddingModel(RagEmbeddingProperties properties) {
        if (!StringUtils.hasText(properties.getApiKey())) {
            throw new IllegalStateException("Google GenAI embedding api-key가 필요합니다.");
        }

        // Google GenAI 클라이언트 인스턴스 생성
        Client client = Client.builder()
                .apiKey(properties.getApiKey())
                .build();
        // 커스텀 GoogleGenAiEmbeddingModel 구현체 반환
        return new GoogleGenAiEmbeddingModel(client, properties);
    }
}
