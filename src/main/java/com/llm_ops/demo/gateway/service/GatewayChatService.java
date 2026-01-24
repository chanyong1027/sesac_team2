package com.llm_ops.demo.gateway.service;

import com.google.genai.Client;
import com.google.genai.types.GenerateContentResponse;
import com.llm_ops.demo.gateway.config.GatewayModelProperties;
import com.llm_ops.demo.gateway.dto.GatewayChatRequest;
import com.llm_ops.demo.gateway.dto.GatewayChatResponse;
import com.llm_ops.demo.gateway.dto.GatewayChatUsage;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.keys.service.OrganizationApiKeyAuthService;
import com.llm_ops.demo.keys.service.ProviderCredentialService;
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
import java.util.UUID;

/**
 * 게이트웨이의 핵심 비즈니스 로직을 처리하는 서비스 클래스입니다.
 * API 키 인증, 프롬프트 렌더링, Spring AI를 통한 LLM 호출을 총괄합니다.
 */
@Service
public class GatewayChatService {

    private static final String DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";

    private final OrganizationApiKeyAuthService organizationApiKeyAuthService;
    private final GatewayChatProviderResolveService gatewayChatProviderResolveService;
    private final GatewayChatOptionsCreateService gatewayChatOptionsCreateService;
    private final ProviderCredentialService providerCredentialService;
    private final GatewayModelProperties gatewayModelProperties;
    private final ObjectProvider<ChatModel> openAiChatModelProvider;

    public GatewayChatService(
            OrganizationApiKeyAuthService organizationApiKeyAuthService,
            GatewayChatProviderResolveService gatewayChatProviderResolveService,
            GatewayChatOptionsCreateService gatewayChatOptionsCreateService,
            ProviderCredentialService providerCredentialService,
            GatewayModelProperties gatewayModelProperties,
            @Qualifier("openAiChatModel") ObjectProvider<ChatModel> openAiChatModelProvider
    ) {
        this.organizationApiKeyAuthService = organizationApiKeyAuthService;
        this.gatewayChatProviderResolveService = gatewayChatProviderResolveService;
        this.gatewayChatOptionsCreateService = gatewayChatOptionsCreateService;
        this.providerCredentialService = providerCredentialService;
        this.gatewayModelProperties = gatewayModelProperties;
        this.openAiChatModelProvider = openAiChatModelProvider;
    }

    /**
     * 인증된 사용자의 요청을 받아 LLM 응답을 생성하고 반환합니다.
     *
     * @param apiKey  X-API-Key 헤더로 받은 인증용 API 키
     * @param request 게이트웨이 채팅 요청 DTO
     * @return LLM의 답변 및 관련 메타데이터가 포함된 응답 DTO
     */
    public GatewayChatResponse chat(String apiKey, GatewayChatRequest request) {
        // 1. API 키를 인증하여 조직 ID를 확인합니다.
        Long organizationId = organizationApiKeyAuthService.resolveOrganizationId(apiKey);
        // TODO: Validate workspaceId belongs to organizationId once workspace domain is available.

        // 2. 프롬프트 템플릿에 변수를 주입하여 최종 프롬프트를 생성합니다.
        String prompt = renderPrompt(request.promptKey(), request.variables());

        // 3. 요청 시점에 조직별 API 키를 주입하여 LLM을 호출합니다.
        // 요청 시점에 조직별 Provider와 API 키를 결정해 멀티테넌시 분리를 보장합니다.
        ProviderType providerType = gatewayChatProviderResolveService.resolve(organizationId, request);
        String providerApiKey = providerCredentialService.getDecryptedApiKey(organizationId, providerType);
        ChatResponse response = switch (providerType) {
            case OPENAI -> callOpenAi(prompt, providerApiKey);
            case ANTHROPIC -> callAnthropic(prompt, providerApiKey);
            case GEMINI -> callGemini(prompt, providerApiKey);
        };

        // 4. LLM 응답을 파싱하고 최종 응답 DTO를 구성합니다.
        String answer = response.getResult().getOutput().getText();
        String usedModel = response.getMetadata() != null ? response.getMetadata().getModel() : null;

        String traceId = UUID.randomUUID().toString();
        return GatewayChatResponse.from(
                traceId,
                answer,
                false, // TODO: Failover 로직 구현 시 동적으로 설정 필요
                usedModel,
                extractUsage(response)
        );
    }

    /**
     * 프롬프트 키(템플릿)와 변수 맵을 사용하여 최종 프롬프트 문자열을 생성(렌더링)합니다.
     */
    private String renderPrompt(String promptKey, Map<String, String> variables) {
        if (variables == null || variables.isEmpty()) {
            return promptKey;
        }

        String rendered = promptKey;
        for (Map.Entry<String, String> entry : variables.entrySet()) {
            String placeholder = "{{" + entry.getKey() + "}}";
            rendered = rendered.replace(placeholder, entry.getValue());
        }
        return rendered;
    }

    /**
     * Spring AI의 ChatResponse 메타데이터에서 토큰 사용량 정보를 추출합니다.
     */
    private GatewayChatUsage extractUsage(ChatResponse response) {
        if (response.getMetadata() == null || response.getMetadata().getUsage() == null) {
            return null;
        }
        Long totalTokens = response.getMetadata().getUsage().getTotalTokens();
        // TODO: Cost calculation logic needs to be implemented.
        return new GatewayChatUsage(totalTokens, null);
    }

    private ChatResponse callOpenAi(String prompt, String apiKey) {
        ChatModel chatModel = openAiChatModelProvider.getIfAvailable();
        if (chatModel == null) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "OpenAI 호출을 위한 설정이 없습니다.");
        }
        String model = gatewayModelProperties.getModels().getOpenai();
        var chatOptions = gatewayChatOptionsCreateService.openAiOptions(apiKey);
        if (model != null && !model.isBlank()) {
            chatOptions.setModel(model);
        }
        return chatModel.call(new Prompt(new UserMessage(prompt), chatOptions));
    }

    private ChatResponse callAnthropic(String prompt, String apiKey) {
        AnthropicChatModel anthropicChatModel = new AnthropicChatModel(new AnthropicApi(apiKey));
        var chatOptions = gatewayChatOptionsCreateService.anthropicOptions();
        String model = gatewayModelProperties.getModels().getAnthropic();
        if (model != null && !model.isBlank()) {
            chatOptions.setModel(model);
        }
        return anthropicChatModel.call(new Prompt(new UserMessage(prompt), chatOptions));
    }

    private ChatResponse callGemini(String prompt, String apiKey) {
        Client client = Client.builder().apiKey(apiKey).build();
        String model = gatewayModelProperties.getModels().getGemini();
        if (model == null || model.isBlank()) {
            model = DEFAULT_GEMINI_MODEL;
        }
        GenerateContentResponse response = client.models.generateContent(
                model,
                prompt,
                null
        );
        if (response == null) {
            ChatResponseMetadata metadata = ChatResponseMetadata.builder()
                    .withModel(model)
                    .build();
            return new ChatResponse(
                    List.of(new Generation(new AssistantMessage(""))),
                    metadata
            );
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
                metadata
        );
    }
}
