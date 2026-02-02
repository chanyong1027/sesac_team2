package com.llm_ops.demo.gateway.service;

import com.google.genai.Client;
import com.google.genai.types.GenerateContentResponse;
import com.llm_ops.demo.gateway.dto.GatewayChatRequest;
import com.llm_ops.demo.gateway.dto.GatewayChatResponse;
import com.llm_ops.demo.gateway.dto.GatewayChatUsage;
import com.llm_ops.demo.gateway.log.service.RequestLogWriter;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.keys.service.OrganizationApiKeyAuthService;
import com.llm_ops.demo.keys.service.ProviderCredentialService;
import com.llm_ops.demo.prompt.domain.PromptRelease;
import com.llm_ops.demo.prompt.domain.PromptStatus;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import com.llm_ops.demo.prompt.repository.PromptReleaseRepository;
import com.llm_ops.demo.prompt.repository.PromptRepository;
import com.llm_ops.demo.rag.dto.ChunkDetailResponse;
import com.llm_ops.demo.rag.dto.RagSearchResponse;
import com.llm_ops.demo.rag.service.RagSearchService;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.domain.WorkspaceStatus;
import com.llm_ops.demo.workspace.repository.WorkspaceRepository;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 게이트웨이의 핵심 비즈니스 로직을 처리하는 서비스 클래스입니다.
 * API 키 인증, 프롬프트 렌더링, Spring AI를 통한 LLM 호출을 총괄합니다.
 */
@Service
public class GatewayChatService {

    private static final String GATEWAY_CHAT_COMPLETIONS_PATH = "/v1/chat/completions";
    private static final String GATEWAY_HTTP_METHOD = "POST";
    private static final String DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";
    private static final int MAX_RAG_CHUNKS = 10;
    private static final int MAX_RAG_CHARS = 4000;
    private static final String RAG_TRUNCATED_MARKER = "[TRUNCATED]";
    private static final String RAG_CONTEXT_TEMPLATE = """
            다음은 질문과 관련된 참고 문서입니다:

            %s

            위 문서를 참고하여 다음 질문에 답변해주세요:

            """;

    private final OrganizationApiKeyAuthService organizationApiKeyAuthService;
    private final GatewayChatOptionsCreateService gatewayChatOptionsCreateService;
    private final ProviderCredentialService providerCredentialService;
    private final ObjectProvider<ChatModel> openAiChatModelProvider;
    private final RagSearchService ragSearchService;
    private final WorkspaceRepository workspaceRepository;
    private final RequestLogWriter requestLogWriter;
    private final PromptRepository promptRepository;
    private final PromptReleaseRepository promptReleaseRepository;

    public GatewayChatService(
            OrganizationApiKeyAuthService organizationApiKeyAuthService,
            GatewayChatOptionsCreateService gatewayChatOptionsCreateService,
            ProviderCredentialService providerCredentialService,
            @Qualifier("openAiChatModel") ObjectProvider<ChatModel> openAiChatModelProvider,
            @Autowired(required = false) RagSearchService ragSearchService,
            WorkspaceRepository workspaceRepository,
            RequestLogWriter requestLogWriter,
        PromptRepository promptRepository,
            PromptReleaseRepository promptReleaseRepository) {
        this.organizationApiKeyAuthService = organizationApiKeyAuthService;
        this.gatewayChatOptionsCreateService = gatewayChatOptionsCreateService;
        this.providerCredentialService = providerCredentialService;
        this.openAiChatModelProvider = openAiChatModelProvider;
        this.ragSearchService = ragSearchService;
        this.workspaceRepository = workspaceRepository;
        this.requestLogWriter = requestLogWriter;
        this.promptRepository = promptRepository;
        this.promptReleaseRepository = promptReleaseRepository;
    }

    /**
     * 인증된 사용자의 요청을 받아 LLM 응답을 생성하고 반환합니다.
     *
     * @param apiKey  X-API-Key 헤더로 받은 인증용 API 키
     * @param request 게이트웨이 채팅 요청 DTO
     * @return LLM의 답변 및 관련 메타데이터가 포함된 응답 DTO
     */
    public GatewayChatResponse chat(String apiKey, GatewayChatRequest request) {
        OrganizationApiKeyAuthService.AuthResult authResult = organizationApiKeyAuthService.resolveAuthResult(apiKey);
        Long organizationId = authResult.organizationId();

        long startedAtNanos = System.nanoTime();

        String traceId = UUID.randomUUID().toString();
        UUID requestId = requestLogWriter.start(new RequestLogWriter.StartRequest(
                null,
                traceId,
                organizationId,
                request.workspaceId(),
                authResult.apiKeyId(),
                authResult.apiKeyPrefix(),
                GATEWAY_CHAT_COMPLETIONS_PATH,
                GATEWAY_HTTP_METHOD,
                request.promptKey(),
                request.isRagEnabled()));

        Integer ragLatencyMs = null;
        Integer ragChunksCount = null;
        Integer ragContextChars = null;
        Boolean ragContextTruncated = null;
        String ragContextHash = null;

        try {
            Workspace workspace = findWorkspace(organizationId, request.workspaceId());
            PromptVersion activeVersion = resolveActiveVersion(workspace, request.promptKey());

            String renderedUserPrompt = renderPrompt(resolveUserTemplate(activeVersion, request.promptKey()),
                    request.variables());
            String renderedSystemPrompt = renderOptionalTemplate(activeVersion.getSystemPrompt(), request.variables());

            String prompt = renderedSystemPrompt == null || renderedSystemPrompt.isBlank()
                    ? renderedUserPrompt
                    : renderedSystemPrompt + "\n\n" + renderedUserPrompt;

            if (request.isRagEnabled()) {
                ragChunksCount = 0;
                ragContextChars = 0;
                ragContextTruncated = false;
                ragLatencyMs = 0;

                if (ragSearchService != null) {
                    long ragStartedAtNanos = System.nanoTime();
                    RagSearchResponse ragResponse = ragSearchService.search(request.workspaceId(), renderedUserPrompt);
                    ragLatencyMs = toLatencyMs(ragStartedAtNanos);

                    if (ragResponse.chunks() != null && !ragResponse.chunks().isEmpty()) {
                        RagContextResult result = buildRagContextWithMetrics(ragResponse.chunks());
                        ragChunksCount = result.chunksIncluded;
                        ragContextChars = result.contextChars;
                        ragContextTruncated = result.truncated;
                        ragContextHash = sha256HexOrNull(result.context);
                        prompt = String.format(RAG_CONTEXT_TEMPLATE, result.context) + prompt;
                    }
                }
            }

            ProviderType providerType = activeVersion.getProvider();
            String requestedModel = activeVersion.getModel();
            String providerApiKey = providerCredentialService.getDecryptedApiKey(organizationId, providerType);
            ChatResponse response = switch (providerType) {
                case OPENAI -> callOpenAi(prompt, providerApiKey, requestedModel);
                case ANTHROPIC -> callAnthropic(prompt, providerApiKey, requestedModel);
                case GEMINI -> callGemini(prompt, providerApiKey, requestedModel);
            };

            String answer = response.getResult().getOutput().getText();
            String usedModel = response.getMetadata() != null ? response.getMetadata().getModel() : null;

            GatewayChatUsage usage = extractUsage(response);

            requestLogWriter.markSuccess(requestId, new RequestLogWriter.SuccessUpdate(
                    200,
                    toLatencyMs(startedAtNanos),
                    providerType.name().toLowerCase(),
                    requestedModel,
                    usedModel,
                    false,
                    null,
                    null,
                    safeToInteger(usage != null ? usage.totalTokens() : null),
                    ragLatencyMs,
                    ragChunksCount,
                    ragContextChars,
                    ragContextTruncated,
                    ragContextHash));

            return GatewayChatResponse.from(
                    traceId,
                    answer,
                    false,
                    usedModel,
                    usage);
        } catch (BusinessException e) {
            requestLogWriter.markFail(requestId, new RequestLogWriter.FailUpdate(
                    e.getErrorCode().getStatus().value(),
                    toLatencyMs(startedAtNanos),
                    null,
                    null,
                    null,
                    false,
                    null,
                    null,
                    null,
                    e.getErrorCode().name(),
                    e.getMessage(),
                    "BUSINESS_EXCEPTION",
                    ragLatencyMs,
                    ragChunksCount,
                    ragContextChars,
                    ragContextTruncated,
                    ragContextHash));
            throw e;
        } catch (Exception e) {
            requestLogWriter.markFail(requestId, new RequestLogWriter.FailUpdate(
                    ErrorCode.INTERNAL_SERVER_ERROR.getStatus().value(),
                    toLatencyMs(startedAtNanos),
                    null,
                    null,
                    null,
                    false,
                    null,
                    null,
                    null,
                    ErrorCode.INTERNAL_SERVER_ERROR.name(),
                    "Unhandled exception",
                    "UNHANDLED_EXCEPTION",
                    ragLatencyMs,
                    ragChunksCount,
                    ragContextChars,
                    ragContextTruncated,
                    ragContextHash));
            throw e;
        }
    }

    private static class RagContextResult {
        private final String context;
        private final int chunksIncluded;
        private final int contextChars;
        private final boolean truncated;

        private RagContextResult(String context, int chunksIncluded, int contextChars, boolean truncated) {
            this.context = context;
            this.chunksIncluded = chunksIncluded;
            this.contextChars = contextChars;
            this.truncated = truncated;
        }
    }

    private RagContextResult buildRagContextWithMetrics(List<ChunkDetailResponse> chunks) {
        if (chunks == null || chunks.isEmpty()) {
            return new RagContextResult("", 0, 0, false);
        }

        StringBuilder builder = new StringBuilder();
        int count = 0;
        int totalChars = 0;
        boolean truncated = false;

        for (ChunkDetailResponse chunk : chunks) {
            if (count >= MAX_RAG_CHUNKS) {
                truncated = true;
                break;
            }
            if (chunk == null || chunk.content() == null || chunk.content().isBlank()) {
                continue;
            }

            String content = chunk.content();
            int remaining = MAX_RAG_CHARS - totalChars;
            if (remaining <= 0) {
                truncated = true;
                break;
            }

            if (content.length() > remaining) {
                content = content.substring(0, remaining);
                truncated = true;
            }

            if (builder.length() > 0) {
                builder.append("\n\n---\n\n");
            }
            builder.append(content);
            totalChars += content.length();
            count++;

            if (totalChars >= MAX_RAG_CHARS) {
                truncated = true;
                break;
            }
        }

        if (truncated) {
            if (builder.length() > 0) {
                builder.append("\n\n---\n\n");
            }
            builder.append(RAG_TRUNCATED_MARKER);
        }

        return new RagContextResult(builder.toString(), count, totalChars, truncated);
    }

    private static String sha256HexOrNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                builder.append(String.format("%02x", b));
            }
            return builder.toString();
        } catch (Exception e) {
            return null;
        }
    }

    private static Integer toLatencyMs(long startedAtNanos) {
        long elapsedNanos = System.nanoTime() - startedAtNanos;
        if (elapsedNanos <= 0) {
            return 0;
        }
        long elapsedMs = elapsedNanos / 1_000_000L;
        return elapsedMs > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) elapsedMs;
    }

    private static Integer safeToInteger(Long value) {
        if (value == null) {
            return null;
        }
        if (value > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        if (value < Integer.MIN_VALUE) {
            return Integer.MIN_VALUE;
        }
        return value.intValue();
    }

    private Workspace findWorkspace(Long organizationId, Long workspaceId) {
        if (workspaceId == null || workspaceId <= 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "workspaceId가 필요합니다.");
        }
        return workspaceRepository
                .findByIdAndOrganizationIdAndStatus(workspaceId, organizationId, WorkspaceStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN, "워크스페이스 접근 권한이 없습니다."));
    }

    private PromptVersion resolveActiveVersion(Workspace workspace, String promptKey) {
        com.llm_ops.demo.prompt.domain.Prompt promptEntity = promptRepository
                .findByWorkspaceAndPromptKeyAndStatus(workspace, promptKey, PromptStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "프롬프트를 찾을 수 없습니다."));
        PromptRelease release = promptReleaseRepository.findWithActiveVersionByPromptId(promptEntity.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "릴리즈된 버전이 없습니다."));
        return release.getActiveVersion();
    }

    private String resolveUserTemplate(PromptVersion version, String fallbackPromptKey) {
        if (version == null) {
            return "{{question}}";
        }
        String template = version.getUserTemplate();
        // 템플릿이 없으면 단순히 프롬프트 키를 사용하는 대신, 기본적으로 {{question}} 변수를 사용하도록 처리
        return (template == null || template.isBlank()) ? "{{question}}" : template;
    }

    private String renderOptionalTemplate(String template, Map<String, String> variables) {
        if (template == null || template.isBlank()) {
            return null;
        }
        return renderPrompt(template, variables);
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
            String key = entry.getKey();
            String value = entry.getValue();
            String doubleBrace = "{{" + key + "}}";
            String singleBrace = "{" + key + "}";
            rendered = rendered.replace(doubleBrace, value);
            rendered = rendered.replace(singleBrace, value);
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

    private ChatResponse callOpenAi(String prompt, String apiKey, String modelOverride) {
        ChatModel chatModel = openAiChatModelProvider.getIfAvailable();
        if (chatModel == null) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "OpenAI 호출을 위한 설정이 없습니다.");
        }
        var chatOptions = gatewayChatOptionsCreateService.openAiOptions(apiKey);
        if (modelOverride != null && !modelOverride.isBlank()) {
            chatOptions.setModel(modelOverride);
        }
        return chatModel.call(new Prompt(new UserMessage(prompt), chatOptions));
    }

    private ChatResponse callAnthropic(String prompt, String apiKey, String modelOverride) {
        AnthropicChatModel anthropicChatModel = new AnthropicChatModel(new AnthropicApi(apiKey));
        var chatOptions = gatewayChatOptionsCreateService.anthropicOptions();
        if (modelOverride != null && !modelOverride.isBlank()) {
            chatOptions.setModel(modelOverride);
        }
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
}
