package com.llm_ops.demo.eval.service;

import com.google.genai.Client;
import com.google.genai.types.GenerateContentResponse;
import com.llm_ops.demo.gateway.pricing.ModelPricing;
import com.llm_ops.demo.gateway.service.GatewayChatOptionsCreateService;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.keys.service.ProviderCredentialService;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.ai.anthropic.AnthropicChatModel;
import org.springframework.ai.anthropic.api.AnthropicApi;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.DefaultUsage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.stereotype.Service;

@Service
public class EvalModelRunnerService {

    private static final String DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";

    private final ProviderCredentialService providerCredentialService;
    private final GatewayChatOptionsCreateService gatewayChatOptionsCreateService;

    public EvalModelRunnerService(
            ProviderCredentialService providerCredentialService,
            GatewayChatOptionsCreateService gatewayChatOptionsCreateService
    ) {
        this.providerCredentialService = providerCredentialService;
        this.gatewayChatOptionsCreateService = gatewayChatOptionsCreateService;
    }

    public ModelExecution run(
            Long organizationId,
            ProviderType provider,
            String model,
            String prompt,
            Double temperature,
            Integer maxOutputTokens
    ) {
        if (provider == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "provider가 필요합니다.");
        }
        if (prompt == null || prompt.isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "prompt가 비어 있습니다.");
        }

        ProviderCredentialService.ResolvedProviderApiKey resolved =
                providerCredentialService.resolveApiKey(organizationId, provider);

        long startedAtNanos = System.nanoTime();
        ChatResponse response = switch (provider) {
            case OPENAI -> callOpenAi(resolved.apiKey(), model, prompt, temperature, maxOutputTokens);
            case ANTHROPIC -> callAnthropic(resolved.apiKey(), model, prompt, temperature, maxOutputTokens);
            case GEMINI -> callGemini(resolved.apiKey(), model, prompt);
        };

        String output = response.getResult() != null && response.getResult().getOutput() != null
                ? response.getResult().getOutput().getText()
                : "";

        String usedModel = response.getMetadata() != null && response.getMetadata().getModel() != null
                ? response.getMetadata().getModel()
                : model;

        Long inputTokens = null;
        Long outputTokens = null;
        Long totalTokens = null;

        if (response.getMetadata() != null && response.getMetadata().getUsage() != null) {
            inputTokens = response.getMetadata().getUsage().getPromptTokens();
            outputTokens = response.getMetadata().getUsage().getGenerationTokens();
            totalTokens = response.getMetadata().getUsage().getTotalTokens();
        }

        if (totalTokens == null && inputTokens != null && outputTokens != null) {
            totalTokens = inputTokens + outputTokens;
        }

        BigDecimal estimatedCost = null;
        String pricingModel = usedModel != null ? usedModel : model;
        if (inputTokens != null && outputTokens != null) {
            estimatedCost = ModelPricing.calculateCost(pricingModel, toInt(inputTokens), toInt(outputTokens));
        } else if (totalTokens != null) {
            estimatedCost = ModelPricing.calculateCostFromTotalTokens(pricingModel, toInt(totalTokens));
        }

        long latencyMs = Math.max(0L, (System.nanoTime() - startedAtNanos) / 1_000_000L);
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("provider", provider.name());
        meta.put("requestedModel", model);
        meta.put("usedModel", usedModel);
        meta.put("latencyMs", latencyMs);
        meta.put("inputTokens", inputTokens);
        meta.put("outputTokens", outputTokens);
        meta.put("totalTokens", totalTokens);
        meta.put("estimatedCostUsd", estimatedCost);
        meta.put("pricingVersion", ModelPricing.getPricingVersion());

        return new ModelExecution(output, meta);
    }

    private ChatResponse callOpenAi(
            String apiKey,
            String model,
            String prompt,
            Double temperature,
            Integer maxOutputTokens
    ) {
        OpenAiChatModel chatModel = new OpenAiChatModel(new OpenAiApi(apiKey));
        OpenAiChatOptions options = OpenAiChatOptions.builder().build();
        if (model != null && !model.isBlank()) {
            options.setModel(model);
        }
        applyNumericOptionBestEffort(options, "setTemperature", temperature);
        configureOpenAiMaxTokens(options, maxOutputTokens);
        return chatModel.call(new Prompt(new UserMessage(prompt), options));
    }

    private ChatResponse callAnthropic(
            String apiKey,
            String model,
            String prompt,
            Double temperature,
            Integer maxOutputTokens
    ) {
        AnthropicChatModel chatModel = new AnthropicChatModel(new AnthropicApi(apiKey));
        var options = gatewayChatOptionsCreateService.anthropicOptions();
        if (model != null && !model.isBlank()) {
            options.setModel(model);
        }
        applyNumericOptionBestEffort(options, "setTemperature", temperature);
        applyIntegerOptionBestEffort(options, maxOutputTokens);
        return chatModel.call(new Prompt(new UserMessage(prompt), options));
    }

    private ChatResponse callGemini(String apiKey, String modelOverride, String prompt) {
        String model = (modelOverride == null || modelOverride.isBlank()) ? DEFAULT_GEMINI_MODEL : modelOverride;
        try (Client client = Client.builder().apiKey(apiKey).build()) {
            GenerateContentResponse response = client.models.generateContent(model, prompt, null);
            String output = response != null ? response.text() : "";
            String resolvedModel = response != null ? response.modelVersion().orElse(model) : model;

            ChatResponseMetadata.Builder metadataBuilder = ChatResponseMetadata.builder().withModel(resolvedModel);
            if (response != null) {
                response.responseId().ifPresent(metadataBuilder::withId);
                response.usageMetadata().ifPresent(usage -> {
                    Long promptTokens = usage.promptTokenCount().map(Integer::longValue).orElse(null);
                    Long completionTokens = usage.candidatesTokenCount().map(Integer::longValue).orElse(null);
                    Long totalTokens = usage.totalTokenCount().map(Integer::longValue).orElse(null);
                    metadataBuilder.withUsage(new DefaultUsage(promptTokens, completionTokens, totalTokens));
                });
            }

            return new ChatResponse(
                    java.util.List.of(new Generation(new AssistantMessage(output))),
                    metadataBuilder.build()
            );
        }
    }

    private static void applyIntegerOptionBestEffort(Object options, Integer maxOutputTokens) {
        if (options == null || maxOutputTokens == null || maxOutputTokens <= 0) {
            return;
        }
        // Only apply one max-token setter to avoid sending conflicting fields
        // (e.g. max_tokens + max_completion_tokens) in the same request.
        if (tryInvoke(options, "setMaxTokens", maxOutputTokens)) {
            return;
        }
        if (tryInvoke(options, "setMaxOutputTokens", maxOutputTokens)) {
            return;
        }
        tryInvoke(options, "setMaxCompletionTokens", maxOutputTokens);
    }

    private static void configureOpenAiMaxTokens(OpenAiChatOptions options, Integer maxOutputTokens) {
        if (options == null) {
            return;
        }
        // Some Spring AI/OpenAI combinations can end up sending both max_tokens and
        // max_completion_tokens. Normalize first to avoid conflicting payload.
        clearOpenAiTokenFields(options);
        if (maxOutputTokens == null || maxOutputTokens <= 0) {
            return;
        }

        if (tryInvoke(options, "setMaxTokens", maxOutputTokens)) {
            invokeNullable(options, "setMaxCompletionTokens");
            return;
        }
        if (tryInvoke(options, "setMaxCompletionTokens", maxOutputTokens)) {
            invokeNullable(options, "setMaxTokens");
            return;
        }
        if (tryInvoke(options, "setMaxOutputTokens", maxOutputTokens)) {
            invokeNullable(options, "setMaxCompletionTokens");
            invokeNullable(options, "setMaxTokens");
        }
    }

    private static void clearOpenAiTokenFields(OpenAiChatOptions options) {
        invokeNullable(options, "setMaxTokens");
        invokeNullable(options, "setMaxCompletionTokens");
        invokeNullable(options, "setMaxOutputTokens");
    }

    private static void invokeNullable(Object target, String methodName) {
        try {
            var method = target.getClass().getMethod(methodName, Integer.class);
            method.invoke(target, new Object[]{null});
        } catch (Exception ignored) {
        }
    }

    private static void applyNumericOptionBestEffort(Object options, String setterName, Double value) {
        if (options == null || value == null) {
            return;
        }
        tryInvoke(options, setterName, value);
        tryInvoke(options, setterName, value.floatValue());
    }

    private static boolean tryInvoke(Object target, String methodName, Object value) {
        Class<?> valueClass = value.getClass();
        try {
            var method = target.getClass().getMethod(methodName, valueClass);
            method.invoke(target, value);
            return true;
        } catch (Exception ignored) {
        }

        if (value instanceof Number number) {
            try {
                var method = target.getClass().getMethod(methodName, int.class);
                method.invoke(target, number.intValue());
                return true;
            } catch (Exception ignored) {
            }
            try {
                var method = target.getClass().getMethod(methodName, Integer.class);
                method.invoke(target, number.intValue());
                return true;
            } catch (Exception ignored) {
            }
            try {
                var method = target.getClass().getMethod(methodName, double.class);
                method.invoke(target, number.doubleValue());
                return true;
            } catch (Exception ignored) {
            }
            try {
                var method = target.getClass().getMethod(methodName, Double.class);
                method.invoke(target, number.doubleValue());
                return true;
            } catch (Exception ignored) {
            }
        }
        return false;
    }

    private static int toInt(Long value) {
        if (value == null) {
            return 0;
        }
        if (value > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        if (value < 0) {
            return 0;
        }
        return value.intValue();
    }

    public record ModelExecution(String outputText, Map<String, Object> meta) {
    }
}
