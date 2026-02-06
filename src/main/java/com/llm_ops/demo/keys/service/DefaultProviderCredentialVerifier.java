package com.llm_ops.demo.keys.service;

import com.google.genai.Client;
import com.google.genai.types.GenerateContentResponse;
import com.llm_ops.demo.gateway.service.GatewayChatOptionsCreateService;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.prompt.service.PromptModelAllowlistService;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.anthropic.AnthropicChatModel;
import org.springframework.ai.anthropic.api.AnthropicApi;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.anthropic.AnthropicChatOptions;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Service
@Profile("!test")
@RequiredArgsConstructor
public class DefaultProviderCredentialVerifier implements ProviderCredentialVerifier {

    private static final String VALIDATION_PROMPT = "ping";
    private static final String DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";

    private final PromptModelAllowlistService promptModelAllowlistService;
    private final GatewayChatOptionsCreateService gatewayChatOptionsCreateService;

    @Override
    public void verify(ProviderType providerType, String apiKey) {
        if (providerType == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "지원하지 않는 provider 입니다.");
        }

        String model = resolveValidationModel(providerType);

        try {
            switch (providerType) {
                case OPENAI -> callOpenAi(apiKey, model);
                case ANTHROPIC -> callAnthropic(apiKey, model);
                case GEMINI -> callGemini(apiKey, model);
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "API 키 검증에 실패했습니다.");
        }
    }

    private String resolveValidationModel(ProviderType providerType) {
        Map<String, List<String>> allowlist = promptModelAllowlistService.getAllowlist();
        List<String> models = allowlist.getOrDefault(providerType.name(), List.of());
        String model = models.isEmpty() ? null : models.get(0);

        if ((providerType == ProviderType.OPENAI || providerType == ProviderType.ANTHROPIC)
                && (model == null || model.isBlank())) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "검증 가능한 모델이 없습니다.");
        }

        return model;
    }

    private void callOpenAi(String apiKey, String model) {
        OpenAiChatModel chatModel = new OpenAiChatModel(new OpenAiApi(apiKey));
        OpenAiChatOptions options = OpenAiChatOptions.builder().build();
        if (model != null && !model.isBlank()) {
            options.setModel(model);
        }
        chatModel.call(new Prompt(new UserMessage(VALIDATION_PROMPT), options));
    }

    private void callAnthropic(String apiKey, String model) {
        AnthropicChatModel chatModel = new AnthropicChatModel(new AnthropicApi(apiKey));
        AnthropicChatOptions options = gatewayChatOptionsCreateService.anthropicOptions();
        if (model != null && !model.isBlank()) {
            options.setModel(model);
        }
        chatModel.call(new Prompt(new UserMessage(VALIDATION_PROMPT), options));
    }

    private void callGemini(String apiKey, String modelOverride) {
        Client client = Client.builder().apiKey(apiKey).build();
        String model = (modelOverride == null || modelOverride.isBlank())
                ? DEFAULT_GEMINI_MODEL
                : modelOverride;
        GenerateContentResponse response = client.models.generateContent(
                model,
                VALIDATION_PROMPT,
                null);
        if (response == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "API 키 검증에 실패했습니다.");
        }
    }
}
