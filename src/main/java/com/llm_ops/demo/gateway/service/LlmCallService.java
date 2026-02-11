package com.llm_ops.demo.gateway.service;

import com.google.genai.Client;
import com.google.genai.types.GenerateContentResponse;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.service.ProviderCredentialService.ResolvedProviderApiKey;
import org.springframework.ai.anthropic.AnthropicChatModel;
import org.springframework.ai.anthropic.api.AnthropicApi;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.DefaultUsage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class LlmCallService {

    private static final String DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";

    private final GatewayChatOptionsCreateService gatewayChatOptionsCreateService;
    private final ObjectProvider<ChatModel> openAiChatModelProvider;

    public LlmCallService(
            GatewayChatOptionsCreateService gatewayChatOptionsCreateService,
            @Qualifier("openAiChatModel") ObjectProvider<ChatModel> openAiChatModelProvider) {
        this.gatewayChatOptionsCreateService = gatewayChatOptionsCreateService;
        this.openAiChatModelProvider = openAiChatModelProvider;
    }

    public ChatResponse callProvider(
            ResolvedProviderApiKey resolved,
            String requestedModel,
            String prompt,
            Integer maxOutputTokensOverride) {
        String providerApiKey = resolved.apiKey();
        return switch (resolved.providerType()) {
            case OPENAI -> callOpenAi(prompt, providerApiKey, requestedModel, maxOutputTokensOverride);
            case ANTHROPIC -> callAnthropic(prompt, providerApiKey, requestedModel, maxOutputTokensOverride);
            case GEMINI -> callGemini(prompt, providerApiKey, requestedModel);
        };
    }

    private ChatResponse callOpenAi(String prompt, String apiKey, String modelOverride, Integer maxOutputTokensOverride) {
        ChatModel chatModel = openAiChatModelProvider.getIfAvailable();
        if (chatModel == null) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "OpenAI 호출을 위한 설정이 없습니다.");
        }
        var chatOptions = gatewayChatOptionsCreateService.openAiOptions(apiKey);
        if (modelOverride != null && !modelOverride.isBlank()) {
            chatOptions.setModel(modelOverride);
        }
        applyMaxOutputTokensBestEffort(chatOptions, maxOutputTokensOverride);
        return chatModel.call(new Prompt(new UserMessage(prompt), chatOptions));
    }

    private ChatResponse callAnthropic(String prompt, String apiKey, String modelOverride, Integer maxOutputTokensOverride) {
        AnthropicChatModel anthropicChatModel = new AnthropicChatModel(new AnthropicApi(apiKey));
        var chatOptions = gatewayChatOptionsCreateService.anthropicOptions();
        if (modelOverride != null && !modelOverride.isBlank()) {
            chatOptions.setModel(modelOverride);
        }
        applyMaxOutputTokensBestEffort(chatOptions, maxOutputTokensOverride);
        return anthropicChatModel.call(new Prompt(new UserMessage(prompt), chatOptions));
    }

    private ChatResponse callGemini(String prompt, String apiKey, String modelOverride) {
        Client client = Client.builder().apiKey(apiKey).build();
        String model = modelOverride;
        if (model == null || model.isBlank()) {
            model = DEFAULT_GEMINI_MODEL;
        }
        GenerateContentResponse response = client.models.generateContent(
                model,
                prompt,
                null);
        if (response == null) {
            ChatResponseMetadata metadata = ChatResponseMetadata.builder()
                    .withModel(model)
                    .build();
            return new ChatResponse(
                    List.of(new Generation(new AssistantMessage(""))),
                    metadata);
        }

        String answer = response.text();
        String resolvedModel = response.modelVersion().orElse(model);

        ChatResponseMetadata.Builder metadataBuilder = ChatResponseMetadata.builder()
                .withModel(resolvedModel);

        response.responseId().ifPresent(metadataBuilder::withId);

        response.usageMetadata().ifPresent(usage -> {
            Long promptTokens = usage.promptTokenCount().map(Integer::longValue).orElse(null);
            Long completionTokens = usage.candidatesTokenCount().map(Integer::longValue).orElse(null);
            Long totalTokens = usage.totalTokenCount().map(Integer::longValue).orElse(null);
            metadataBuilder.withUsage(new DefaultUsage(promptTokens, completionTokens, totalTokens));
        });

        ChatResponseMetadata metadata = metadataBuilder.build();
        return new ChatResponse(
                List.of(new Generation(new AssistantMessage(answer))),
                metadata);
    }

    static void applyMaxOutputTokensBestEffort(Object chatOptions, Integer maxOutputTokens) {
        if (chatOptions == null || maxOutputTokens == null || maxOutputTokens <= 0) {
            return;
        }
        tryInvokeSetter(chatOptions, "setMaxTokens", maxOutputTokens);
        tryInvokeSetter(chatOptions, "setMaxOutputTokens", maxOutputTokens);
        tryInvokeSetter(chatOptions, "setMaxCompletionTokens", maxOutputTokens);
    }

    private static void tryInvokeSetter(Object target, String methodName, Integer value) {
        try {
            var m = target.getClass().getMethod(methodName, Integer.class);
            m.invoke(target, value);
            return;
        } catch (NoSuchMethodException ignored) {
            // fallthrough
        } catch (Exception ignored) {
            return;
        }
        try {
            var m = target.getClass().getMethod(methodName, int.class);
            m.invoke(target, value.intValue());
        } catch (Exception ignored) {
        }
    }
}
