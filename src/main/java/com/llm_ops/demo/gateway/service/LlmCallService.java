package com.llm_ops.demo.gateway.service;

import com.google.genai.Client;
import com.google.genai.types.GenerateContentConfig;
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
import java.util.Map;

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

    /**
     * 모델 파라미터 오버라이드를 담는 record.
     * null 필드는 프로바이더 기본값을 사용한다.
     */
    public record ModelConfigOverride(
            Double temperature,
            Integer maxTokens,
            Double topP,
            Double frequencyPenalty
    ) {
        public static ModelConfigOverride from(Map<String, Object> map) {
            if (map == null || map.isEmpty()) return null;
            return new ModelConfigOverride(
                    toDouble(map.get("temperature")),
                    toInteger(map.get("maxTokens")),
                    toDouble(map.get("topP")),
                    toDouble(map.get("frequencyPenalty"))
            );
        }

        public static ModelConfigOverride ofMaxTokens(Integer maxTokens) {
            if (maxTokens == null) return null;
            return new ModelConfigOverride(null, maxTokens, null, null);
        }

        private static Double toDouble(Object val) {
            if (val instanceof Number n) return n.doubleValue();
            return null;
        }

        private static Integer toInteger(Object val) {
            if (val instanceof Number n) return n.intValue();
            return null;
        }
    }

    public ChatResponse callProvider(
            ResolvedProviderApiKey resolved,
            String requestedModel,
            String prompt,
            ModelConfigOverride configOverride) {
        String providerApiKey = resolved.apiKey();
        return switch (resolved.providerType()) {
            case OPENAI -> callOpenAi(prompt, providerApiKey, requestedModel, configOverride);
            case ANTHROPIC -> callAnthropic(prompt, providerApiKey, requestedModel, configOverride);
            case GEMINI -> callGemini(prompt, providerApiKey, requestedModel, configOverride);
        };
    }

    private ChatResponse callOpenAi(String prompt, String apiKey, String modelOverride, ModelConfigOverride config) {
        ChatModel chatModel = openAiChatModelProvider.getIfAvailable();
        if (chatModel == null) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "OpenAI 호출을 위한 설정이 없습니다.");
        }
        var chatOptions = gatewayChatOptionsCreateService.openAiOptions(apiKey);
        if (modelOverride != null && !modelOverride.isBlank()) {
            chatOptions.setModel(modelOverride);
        }
        applyModelConfig(chatOptions, config);
        return chatModel.call(new Prompt(new UserMessage(prompt), chatOptions));
    }

    private ChatResponse callAnthropic(String prompt, String apiKey, String modelOverride, ModelConfigOverride config) {
        AnthropicChatModel anthropicChatModel = new AnthropicChatModel(new AnthropicApi(apiKey));
        var chatOptions = gatewayChatOptionsCreateService.anthropicOptions();
        if (modelOverride != null && !modelOverride.isBlank()) {
            chatOptions.setModel(modelOverride);
        }
        applyModelConfig(chatOptions, config);
        return anthropicChatModel.call(new Prompt(new UserMessage(prompt), chatOptions));
    }

    private ChatResponse callGemini(String prompt, String apiKey, String modelOverride, ModelConfigOverride config) {
        Client client = Client.builder().apiKey(apiKey).build();
        String model = modelOverride;
        if (model == null || model.isBlank()) {
            model = DEFAULT_GEMINI_MODEL;
        }

        GenerateContentConfig geminiConfig = null;
        if (config != null) {
            var builder = GenerateContentConfig.builder();
            boolean hasConfig = false;
            if (config.temperature() != null) {
                builder.temperature(config.temperature().floatValue());
                hasConfig = true;
            }
            if (config.maxTokens() != null) {
                builder.maxOutputTokens(config.maxTokens());
                hasConfig = true;
            }
            if (config.topP() != null) {
                builder.topP(config.topP().floatValue());
                hasConfig = true;
            }
            if (config.frequencyPenalty() != null) {
                builder.frequencyPenalty(config.frequencyPenalty().floatValue());
                hasConfig = true;
            }
            if (hasConfig) {
                geminiConfig = builder.build();
            }
        }

        GenerateContentResponse response = client.models.generateContent(
                model,
                prompt,
                geminiConfig);
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

    static void applyModelConfig(Object chatOptions, ModelConfigOverride config) {
        if (chatOptions == null || config == null) return;

        if (config.maxTokens() != null && config.maxTokens() > 0) {
            tryInvokeSetter(chatOptions, "setMaxTokens", config.maxTokens());
            tryInvokeSetter(chatOptions, "setMaxOutputTokens", config.maxTokens());
            tryInvokeSetter(chatOptions, "setMaxCompletionTokens", config.maxTokens());
        }
        if (config.temperature() != null) {
            tryInvokeDoubleSetter(chatOptions, "setTemperature", config.temperature());
        }
        if (config.topP() != null) {
            tryInvokeDoubleSetter(chatOptions, "setTopP", config.topP());
        }
        if (config.frequencyPenalty() != null) {
            tryInvokeDoubleSetter(chatOptions, "setFrequencyPenalty", config.frequencyPenalty());
        }
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

    private static void tryInvokeDoubleSetter(Object target, String methodName, Double value) {
        try {
            var m = target.getClass().getMethod(methodName, Double.class);
            m.invoke(target, value);
            return;
        } catch (NoSuchMethodException ignored) {
            // fallthrough
        } catch (Exception ignored) {
            return;
        }
        try {
            var m = target.getClass().getMethod(methodName, Float.class);
            m.invoke(target, value.floatValue());
            return;
        } catch (NoSuchMethodException ignored) {
            // fallthrough
        } catch (Exception ignored) {
            return;
        }
        try {
            var m = target.getClass().getMethod(methodName, double.class);
            m.invoke(target, value);
        } catch (Exception ignored) {
        }
    }
}
