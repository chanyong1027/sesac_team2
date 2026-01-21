package com.llm_ops.demo.gateway.service;

import lombok.RequiredArgsConstructor;
import org.springframework.ai.anthropic.AnthropicChatOptions;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class GatewayChatOptionsCreateService {

    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    public OpenAiChatOptions openAiOptions(String apiKey) {
        return OpenAiChatOptions.builder()
                .withHttpHeaders(Map.of(AUTHORIZATION_HEADER, BEARER_PREFIX + apiKey))
                .build();
    }

    public AnthropicChatOptions anthropicOptions() {
        return AnthropicChatOptions.builder().build();
    }
}
