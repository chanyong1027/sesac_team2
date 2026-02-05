package com.llm_ops.demo.gateway.service;

import lombok.RequiredArgsConstructor;
import org.springframework.ai.anthropic.AnthropicChatOptions;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Spring AI ChatModel 호출에 필요한 {@link org.springframework.ai.chat.prompt.ChatOptions} 객체를
 * 각 LLM 프로바이더별로 생성하여 제공하는 서비스입니다.
 * 특히 API 키와 같은 동적 설정을 처리합니다.
 */
@Service
@RequiredArgsConstructor
public class GatewayChatOptionsCreateService {

    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    /**
     * OpenAI ChatModel 호출을 위한 {@link OpenAiChatOptions}를 생성합니다.
     * 제공된 API 키를 사용하여 Authorization 헤더를 설정합니다.
     *
     * @param apiKey OpenAI API 키
     * @return 설정된 OpenAiChatOptions 객체
     */
    public OpenAiChatOptions openAiOptions(String apiKey) {
        return OpenAiChatOptions.builder()
                .withHttpHeaders(Map.of(AUTHORIZATION_HEADER, BEARER_PREFIX + apiKey))
                .build();
    }

    /**
     * Anthropic ChatModel 호출을 위한 {@link AnthropicChatOptions}를 생성합니다.
     * 현재는 기본 옵션을 반환합니다.
     *
     * @return 설정된 AnthropicChatOptions 객체
     */
    public AnthropicChatOptions anthropicOptions() {
        return AnthropicChatOptions.builder().build();
    }
}
