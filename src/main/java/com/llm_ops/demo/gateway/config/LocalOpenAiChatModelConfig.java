package com.llm_ops.demo.gateway.config;

import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("local")
public class LocalOpenAiChatModelConfig {

    @Bean
    @ConditionalOnMissingBean(OpenAiChatModel.class)
    public OpenAiChatModel localOpenAiChatModel(@Value("${spring.ai.openai.api-key}") String apiKey) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("spring.ai.openai.api-key is required for local OpenAiChatModel");
        }
        return new OpenAiChatModel(new OpenAiApi(apiKey));
    }
}
