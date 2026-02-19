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
import org.springframework.ai.retry.NonTransientAiException;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;

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

        List<String> models = resolveValidationModels(providerType);

        try {
            switch (providerType) {
                case OPENAI -> callOpenAiWithFallback(apiKey, models);
                case ANTHROPIC -> callAnthropicWithFallback(apiKey, models);
                case GEMINI -> callGeminiWithFallback(apiKey, models);
            }
        } catch (NonTransientAiException e) {
            BusinessException mapped = mapAiAuthException(e);
            if (mapped != null) {
                throw mapped;
            }
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "API 키 검증에 실패했습니다.");
        } catch (HttpStatusCodeException e) {
            if (e.getStatusCode().value() == 401) {
                throw new BusinessException(ErrorCode.UNAUTHENTICATED, "API 키 인증에 실패했습니다.");
            }
            if (e.getStatusCode().value() == 403) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "API 키 권한이 없습니다.");
            }
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "API 키 검증에 실패했습니다.");
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "API 키 검증에 실패했습니다.");
        }
    }

    private BusinessException mapAiAuthException(NonTransientAiException e) {
        Throwable cause = e.getCause();
        if (cause instanceof HttpStatusCodeException statusException) {
            int status = statusException.getStatusCode().value();
            if (status == 401) {
                return new BusinessException(ErrorCode.UNAUTHENTICATED, "API 키 인증에 실패했습니다.");
            }
            if (status == 403) {
                return new BusinessException(ErrorCode.FORBIDDEN, "API 키 권한이 없습니다.");
            }
            if (status == 404) {
                return new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "검증 가능한 모델을 찾을 수 없습니다.");
            }
        }

        String message = e.getMessage();
        if (message == null) {
            return null;
        }
        if (message.contains("401") || message.contains("authentication_error") || message.contains("invalid x-api-key")) {
            return new BusinessException(ErrorCode.UNAUTHENTICATED, "API 키 인증에 실패했습니다.");
        }
        if (message.contains("403")) {
            return new BusinessException(ErrorCode.FORBIDDEN, "API 키 권한이 없습니다.");
        }
        if (message.contains("404") || message.contains("not_found_error") || message.contains("model:")) {
            return new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "검증 가능한 모델을 찾을 수 없습니다.");
        }
        return null;
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

    private List<String> resolveValidationModels(ProviderType providerType) {
        Map<String, List<String>> allowlist = promptModelAllowlistService.getAllowlist();
        List<String> models = allowlist.getOrDefault(providerType.name(), List.of());
        if (models.isEmpty()) {
            if (providerType == ProviderType.OPENAI || providerType == ProviderType.ANTHROPIC) {
                throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "검증 가능한 모델이 없습니다.");
            }
            return List.of();
        }
        return models;
    }

    private void callOpenAi(String apiKey, String model) {
        OpenAiChatModel chatModel = new OpenAiChatModel(new OpenAiApi(apiKey));
        OpenAiChatOptions options = OpenAiChatOptions.builder().build();
        if (model != null && !model.isBlank()) {
            options.setModel(model);
        }
        chatModel.call(new Prompt(new UserMessage(VALIDATION_PROMPT), options));
    }

    private void callOpenAiWithFallback(String apiKey, List<String> models) {
        if (models.isEmpty()) {
            callOpenAi(apiKey, null);
            return;
        }
        BusinessException last = null;
        for (String model : models) {
            try {
                callOpenAi(apiKey, model);
                return;
            } catch (BusinessException e) {
                last = e;
                if (isAuthError(e)) {
                    throw e;
                }
            } catch (NonTransientAiException e) {
                throw e;
            } catch (Exception ignored) {
                // try next model
            }
        }
        if (last != null) {
            throw last;
        }
        throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "API 키 검증에 실패했습니다.");
    }

    private void callAnthropic(String apiKey, String model) {
        AnthropicChatModel chatModel = new AnthropicChatModel(new AnthropicApi(apiKey));
        AnthropicChatOptions options = gatewayChatOptionsCreateService.anthropicOptions();
        if (model != null && !model.isBlank()) {
            options.setModel(model);
        }
        chatModel.call(new Prompt(new UserMessage(VALIDATION_PROMPT), options));
    }

    private void callAnthropicWithFallback(String apiKey, List<String> models) {
        if (models.isEmpty()) {
            callAnthropic(apiKey, null);
            return;
        }
        BusinessException last = null;
        for (String model : models) {
            try {
                callAnthropic(apiKey, model);
                return;
            } catch (BusinessException e) {
                last = e;
                if (isAuthError(e)) {
                    throw e;
                }
            } catch (NonTransientAiException e) {
                throw e;
            } catch (Exception ignored) {
                // try next model
            }
        }
        if (last != null) {
            throw last;
        }
        throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "API 키 검증에 실패했습니다.");
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

    private void callGeminiWithFallback(String apiKey, List<String> models) {
        if (models.isEmpty()) {
            callGemini(apiKey, null);
            return;
        }
        BusinessException last = null;
        for (String model : models) {
            try {
                callGemini(apiKey, model);
                return;
            } catch (BusinessException e) {
                last = e;
                if (isAuthError(e)) {
                    throw e;
                }
            } catch (Exception ignored) {
                // try next model
            }
        }
        if (last != null) {
            throw last;
        }
        throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "API 키 검증에 실패했습니다.");
    }

    private boolean isAuthError(BusinessException exception) {
        ErrorCode code = exception.getErrorCode();
        return code == ErrorCode.UNAUTHENTICATED || code == ErrorCode.FORBIDDEN;
    }
}
