package com.llm_ops.demo.gateway.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.keys.service.ProviderCredentialService;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class GatewayChatOptionsCreateService {

    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    private final ProviderCredentialService providerCredentialService;

    public ChatOptions create(Long organizationId, ProviderType providerType) {
        String apiKey = providerCredentialService.getDecryptedApiKey(organizationId, providerType);

        return switch (providerType) {
            case OPENAI -> openAiOptions(apiKey);
            case ANTHROPIC, GEMINI -> throw new BusinessException(
                    ErrorCode.INVALID_INPUT_VALUE,
                    "지원하지 않는 provider 입니다."
            );
        };
    }

    private OpenAiChatOptions openAiOptions(String apiKey) {
        return OpenAiChatOptions.builder()
                .withHttpHeaders(Map.of(AUTHORIZATION_HEADER, BEARER_PREFIX + apiKey))
                .build();
    }
}
