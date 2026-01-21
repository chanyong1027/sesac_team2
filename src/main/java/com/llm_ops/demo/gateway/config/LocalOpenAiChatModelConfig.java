package com.llm_ops.demo.gateway.config;

import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * 로컬 개발 환경(profile=local)에서만 활성화되는 OpenAI ChatModel 설정입니다.
 * 로컬 테스트 및 개발 편의를 위해 기본 OpenAI ChatModel 빈을 제공합니다.
 */
@Configuration
@Profile("local")
public class LocalOpenAiChatModelConfig {

    /**
     * 로컬 환경에서 사용할 OpenAiChatModel 빈을 생성합니다.
     * 다른 OpenAiChatModel 빈이 없는 경우에만 활성화됩니다.
     *
     * @param apiKey application.yml/properties에 설정된 OpenAI API 키
     * @return OpenAiChatModel 인스턴스
     * @throws IllegalStateException OpenAI API 키가 설정되지 않은 경우
     */
    @Bean(name = "openAiChatModel")
    @ConditionalOnMissingBean(OpenAiChatModel.class)
    public OpenAiChatModel openAiChatModel(@Value("${spring.ai.openai.api-key}") String apiKey) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("spring.ai.openai.api-key is required for local OpenAiChatModel");
        }
        return new OpenAiChatModel(new OpenAiApi(apiKey));
    }
}
