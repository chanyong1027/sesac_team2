package com.llm_ops.demo.prompt.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.gateway.log.service.RequestLogWriter;
import com.llm_ops.demo.gateway.pricing.ModelPricing;
import com.llm_ops.demo.gateway.service.GatewayFailureClassifier;
import com.llm_ops.demo.gateway.service.LlmCallService;
import com.llm_ops.demo.gateway.service.LlmCallService.ModelConfigOverride;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.global.error.GatewayException;
import org.springframework.http.HttpStatus;
import com.llm_ops.demo.keys.service.ProviderCredentialService;
import com.llm_ops.demo.keys.service.ProviderCredentialService.ResolvedProviderApiKey;
import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptStatus;
import com.llm_ops.demo.prompt.dto.PlaygroundRunRequest;
import com.llm_ops.demo.prompt.dto.PlaygroundRunResponse;
import com.llm_ops.demo.prompt.dto.PlaygroundRunResponse.PlaygroundUsage;
import com.llm_ops.demo.prompt.dto.PlaygroundSaveVersionRequest;
import com.llm_ops.demo.prompt.dto.PlaygroundSaveVersionResponse;
import com.llm_ops.demo.prompt.dto.PromptReleaseRequest;
import com.llm_ops.demo.prompt.dto.PromptVersionCreateRequest;
import com.llm_ops.demo.prompt.dto.PromptVersionCreateResponse;
import com.llm_ops.demo.prompt.repository.PromptRepository;
import com.llm_ops.demo.rag.dto.RagSearchResponse;
import com.llm_ops.demo.rag.service.RagContextBuilder;
import com.llm_ops.demo.rag.service.RagSearchService;
import com.llm_ops.demo.rag.service.RagSearchService.RagSearchOptions;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.repository.WorkspaceMemberRepository;
import com.llm_ops.demo.workspace.service.WorkspaceRagSettingsService;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
public class PromptPlaygroundService {

    private static final ObjectMapper LOG_PAYLOAD_MAPPER = new ObjectMapper();
    private static final String UNHANDLED_EXCEPTION_PAYLOAD = "error-logged";
    private static final GatewayFailureClassifier FAILURE_CLASSIFIER = new GatewayFailureClassifier();
    private static final String PLAYGROUND_REQUEST_PATH = "/api/v1/prompts/playground/run";
    private static final String PLAYGROUND_HTTP_METHOD = "POST";
    private static final String RAG_CONTEXT_PREFIX = """
            다음은 질문과 관련된 참고 문서입니다:

            """;
    private static final String RAG_CONTEXT_SUFFIX = """

            위 문서를 참고하여 다음 질문에 답변해주세요:

            """;

    private final PromptRepository promptRepository;
    private final UserRepository userRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final ProviderCredentialService providerCredentialService;
    private final LlmCallService llmCallService;
    private final RagSearchService ragSearchService;
    private final RagContextBuilder ragContextBuilder;
    private final WorkspaceRagSettingsService workspaceRagSettingsService;
    private final RequestLogWriter requestLogWriter;
    private final PromptVersionService promptVersionService;
    private final PromptReleaseService promptReleaseService;

    public PromptPlaygroundService(
            PromptRepository promptRepository,
            UserRepository userRepository,
            WorkspaceMemberRepository workspaceMemberRepository,
            ProviderCredentialService providerCredentialService,
            LlmCallService llmCallService,
            @Nullable RagSearchService ragSearchService,
            RagContextBuilder ragContextBuilder,
            WorkspaceRagSettingsService workspaceRagSettingsService,
            RequestLogWriter requestLogWriter,
            PromptVersionService promptVersionService,
            PromptReleaseService promptReleaseService) {
        this.promptRepository = promptRepository;
        this.userRepository = userRepository;
        this.workspaceMemberRepository = workspaceMemberRepository;
        this.providerCredentialService = providerCredentialService;
        this.llmCallService = llmCallService;
        this.ragSearchService = ragSearchService;
        this.ragContextBuilder = ragContextBuilder;
        this.workspaceRagSettingsService = workspaceRagSettingsService;
        this.requestLogWriter = requestLogWriter;
        this.promptVersionService = promptVersionService;
        this.promptReleaseService = promptReleaseService;
    }

    public PlaygroundRunResponse run(Long promptId, Long userId, PlaygroundRunRequest request) {
        User user = findUser(userId);
        Prompt prompt = findActivePrompt(promptId);
        validateWorkspaceMembership(prompt, user);

        Workspace workspace = prompt.getWorkspace();
        Long organizationId = workspace.getOrganization().getId();
        Long workspaceId = workspace.getId();

        long startedAtNanos = System.nanoTime();
        String traceId = UUID.randomUUID().toString();

        boolean ragEnabled = Boolean.TRUE.equals(request.ragEnabled());

        UUID requestId = requestLogWriter.start(new RequestLogWriter.StartRequest(
                null,
                traceId,
                organizationId,
                workspaceId,
                null,
                null,
                PLAYGROUND_REQUEST_PATH,
                PLAYGROUND_HTTP_METHOD,
                prompt.getPromptKey(),
                ragEnabled,
                toRequestPayloadJson(request),
                "PLAYGROUND"));

        Integer ragLatencyMs = null;
        Integer ragChunksCount = null;
        Integer ragContextChars = null;
        Boolean ragContextTruncated = null;
        String ragContextHash = null;
        Integer ragTopK = null;
        Double ragSimilarityThreshold = null;
        RagSearchResponse ragResponse = null;
        List<RequestLogWriter.RetrievedDocumentInfo> retrievedDocuments = new ArrayList<>();

        try {
            String userPrompt = renderPrompt(request.userTemplate(), request.variables());
            String systemPrompt = renderOptionalTemplate(request.systemPrompt(), request.variables());

            if (ragEnabled && ragSearchService != null) {
                ragChunksCount = 0;
                ragContextChars = 0;
                ragContextTruncated = false;
                ragLatencyMs = 0;

                WorkspaceRagSettingsService.RagRuntimeSettings ragSettings =
                        workspaceRagSettingsService.resolveRuntimeSettings(workspaceId);
                ragTopK = ragSettings.topK();
                ragSimilarityThreshold = ragSettings.similarityThreshold();
                long ragStartedAtNanos = System.nanoTime();
                ragResponse = ragSearchService.search(
                        workspaceId,
                        resolveRagQuery(userPrompt, request.variables()),
                        new RagSearchOptions(
                                ragSettings.topK(),
                                ragSettings.similarityThreshold(),
                                ragSettings.hybridEnabled(),
                                ragSettings.rerankEnabled(),
                                ragSettings.rerankTopN()
                        ));
                ragLatencyMs = toLatencyMs(ragStartedAtNanos);

                if (ragResponse.chunks() != null && !ragResponse.chunks().isEmpty()) {
                    RagContextBuilder.RagContextResult result = ragContextBuilder.build(
                            ragResponse.chunks(),
                            ragSettings.maxChunks(),
                            ragSettings.maxContextChars());
                    ragChunksCount = result.chunksIncluded();
                    ragContextChars = result.contextChars();
                    ragContextTruncated = result.truncated();
                    ragContextHash = sha256HexOrNull(result.context());
                    retrievedDocuments = toRetrievedDocumentInfos(ragResponse, result.chunksIncluded());
                    userPrompt = RAG_CONTEXT_PREFIX + result.context() + RAG_CONTEXT_SUFFIX + userPrompt;
                }
            }

            ResolvedProviderApiKey resolvedKey = providerCredentialService.resolveApiKey(
                    organizationId, request.provider());

            ModelConfigOverride configOverride = ModelConfigOverride.from(request.modelConfig());

            ChatResponse response = llmCallService.callProvider(
                    resolvedKey, request.model(), systemPrompt, userPrompt, configOverride);

            String answer = "";
            if (response.getResult() != null && response.getResult().getOutput() != null) {
                answer = response.getResult().getOutput().getText();
            }
            String usedModel = response.getMetadata() != null ? response.getMetadata().getModel() : null;

            Integer inputTokens = null;
            Integer outputTokens = null;
            Integer totalTokens = null;
            BigDecimal estimatedCost = null;

            if (response.getMetadata() != null && response.getMetadata().getUsage() != null) {
                inputTokens = safeToInteger(response.getMetadata().getUsage().getPromptTokens());
                outputTokens = safeToInteger(response.getMetadata().getUsage().getGenerationTokens());
                totalTokens = safeToInteger(response.getMetadata().getUsage().getTotalTokens());
            }

            if (totalTokens == null && inputTokens != null && outputTokens != null) {
                long sum = (long) inputTokens + (long) outputTokens;
                totalTokens = sum > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) sum;
            }
            if (totalTokens != null) {
                if (inputTokens != null && outputTokens == null) {
                    int computed = totalTokens - inputTokens;
                    if (computed >= 0) outputTokens = computed;
                } else if (outputTokens != null && inputTokens == null) {
                    int computed = totalTokens - outputTokens;
                    if (computed >= 0) inputTokens = computed;
                }
            }

            String pricingModel = usedModel != null ? usedModel : request.model();
            if (inputTokens != null && outputTokens != null) {
                estimatedCost = ModelPricing.calculateCost(pricingModel, inputTokens, outputTokens);
            } else if (totalTokens != null) {
                estimatedCost = ModelPricing.calculateCostFromTotalTokens(pricingModel, totalTokens);
            }

            int latencyMs = toLatencyMs(startedAtNanos);

            requestLogWriter.markSuccess(requestId, new RequestLogWriter.SuccessUpdate(
                    200,
                    latencyMs,
                    promptId,
                    request.baseVersionId(),
                    request.provider().name().toLowerCase(),
                    request.model(),
                    usedModel,
                    false,
                    inputTokens,
                    outputTokens,
                    totalTokens,
                    estimatedCost,
                    ModelPricing.getPricingVersion(),
                    ragLatencyMs,
                    ragChunksCount,
                    ragContextChars,
                    ragContextTruncated,
                    ragContextHash,
                    ragTopK,
                    ragSimilarityThreshold,
                    answer,
                    retrievedDocuments));

            return new PlaygroundRunResponse(
                    traceId,
                    answer,
                    usedModel,
                    new PlaygroundUsage(inputTokens, outputTokens, totalTokens, estimatedCost),
                    latencyMs,
                    LocalDateTime.now());

        } catch (BusinessException e) {
            String errorMessage = resolveBusinessErrorMessage(e);
            requestLogWriter.markFail(requestId, new RequestLogWriter.FailUpdate(
                    e.getErrorCode().getStatus().value(),
                    toLatencyMs(startedAtNanos),
                    promptId,
                    request.baseVersionId(),
                    request.provider() != null ? request.provider().name().toLowerCase() : null,
                    request.model(),
                    null,
                    false,
                    null, null, null, null, null,
                    e.getErrorCode().name(),
                    errorMessage,
                    "BUSINESS_EXCEPTION",
                    ragLatencyMs, ragChunksCount, ragContextChars,
                    ragContextTruncated, ragContextHash, ragTopK, ragSimilarityThreshold,
                    toBusinessErrorResponsePayload(e),
                    retrievedDocuments));
            throw e;
        } catch (Exception e) {
            log.error("Playground run failed: requestId={}", requestId, e);
            GatewayFailureClassifier.GatewayFailure failure = FAILURE_CLASSIFIER.classifyProvider(e);
            requestLogWriter.markFail(requestId, new RequestLogWriter.FailUpdate(
                    failure.httpStatus(),
                    toLatencyMs(startedAtNanos),
                    promptId,
                    request.baseVersionId(),
                    request.provider() != null ? request.provider().name().toLowerCase() : null,
                    request.model(),
                    null,
                    false,
                    null, null, null, null, null,
                    failure.errorCode(),
                    failure.errorMessage(),
                    failure.failReason(),
                    ragLatencyMs, ragChunksCount, ragContextChars,
                    ragContextTruncated, ragContextHash, ragTopK, ragSimilarityThreshold,
                    UNHANDLED_EXCEPTION_PAYLOAD,
                    retrievedDocuments));
            HttpStatus httpStatus = HttpStatus.resolve(failure.httpStatus());
            throw new GatewayException(
                    failure.errorCode(),
                    httpStatus != null ? httpStatus : HttpStatus.INTERNAL_SERVER_ERROR,
                    failure.errorMessage(),
                    e);
        }
    }

    @Transactional
    public PlaygroundSaveVersionResponse saveAsVersion(Long promptId, Long userId, PlaygroundSaveVersionRequest request) {
        PromptVersionCreateRequest versionRequest = new PromptVersionCreateRequest(
                request.title(),
                request.provider(),
                request.model(),
                request.secondaryProvider(),
                request.secondaryModel(),
                request.systemPrompt(),
                request.userTemplate(),
                request.ragEnabled(),
                request.contextUrl(),
                request.modelConfig());

        PromptVersionCreateResponse versionResponse = promptVersionService.create(promptId, userId, versionRequest);

        boolean released = false;
        if (request.releaseAfterSave()) {
            PromptReleaseRequest releaseRequest = new PromptReleaseRequest(
                    versionResponse.id(), "플레이그라운드에서 배포");
            promptReleaseService.release(promptId, userId, releaseRequest);
            released = true;
        }

        return new PlaygroundSaveVersionResponse(versionResponse, released);
    }

    private User findUser(Long userId) {
        if (userId == null) {
            throw new BusinessException(ErrorCode.UNAUTHENTICATED, "로그인이 필요합니다.");
        }
        return userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "사용자를 찾을 수 없습니다."));
    }

    private Prompt findActivePrompt(Long promptId) {
        return promptRepository.findByIdAndStatusWithWorkspaceAndOrganization(promptId, PromptStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "프롬프트를 찾을 수 없습니다."));
    }

    private void validateWorkspaceMembership(Prompt prompt, User user) {
        boolean isMember = workspaceMemberRepository.existsByWorkspaceAndUser(prompt.getWorkspace(), user);
        if (!isMember) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "워크스페이스 멤버가 아닙니다.");
        }
    }

    private String renderPrompt(String template, Map<String, ?> variables) {
        if (template == null) {
            return "";
        }

        if (variables == null || variables.isEmpty()) {
            return template;
        }
        String rendered = template;
        for (Map.Entry<String, ?> entry : variables.entrySet()) {
            String key = entry.getKey();
            String value = entry.getValue() == null ? "" : String.valueOf(entry.getValue());
            rendered = rendered.replace("{{" + key + "}}", value);
        }
        return rendered;
    }

    private String renderOptionalTemplate(String template, Map<String, ?> variables) {
        if (template == null || template.isBlank()) {
            return null;
        }
        return renderPrompt(template, variables);
    }

    private String resolveRagQuery(String renderedUserPrompt, Map<String, ?> variables) {
        if (variables != null) {
            Object question = variables.get("question");
            if (question != null && !question.toString().isBlank()) {
                return question.toString();
            }
        }
        return renderedUserPrompt;
    }

    private static Integer toLatencyMs(long startedAtNanos) {
        long elapsedNanos = System.nanoTime() - startedAtNanos;
        if (elapsedNanos <= 0) return 0;
        long elapsedMs = elapsedNanos / 1_000_000L;
        return elapsedMs > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) elapsedMs;
    }

    private static Integer safeToInteger(Long value) {
        if (value == null) return null;
        if (value > Integer.MAX_VALUE) return Integer.MAX_VALUE;
        if (value < Integer.MIN_VALUE) return Integer.MIN_VALUE;
        return value.intValue();
    }

    private static String sha256HexOrNull(String value) {
        if (value == null || value.isBlank()) return null;
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

    private static String toRequestPayloadJson(PlaygroundRunRequest request) {
        if (request == null) {
            return null;
        }
        try {
            RequestPayloadForLog payload = new RequestPayloadForLog(
                    request.provider() != null ? request.provider().name() : null,
                    request.model(),
                    Boolean.TRUE.equals(request.ragEnabled()),
                    request.systemPrompt() != null && !request.systemPrompt().isBlank(),
                    request.userTemplate() != null ? request.userTemplate().length() : 0,
                    request.modelConfig() != null ? request.modelConfig().size() : 0,
                    request.variables() != null ? request.variables().size() : 0,
                    request.baseVersionId()
            );
            return LOG_PAYLOAD_MAPPER.writeValueAsString(payload);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static List<RequestLogWriter.RetrievedDocumentInfo> toRetrievedDocumentInfos(
            RagSearchResponse ragResponse,
            int includedCount
    ) {
        if (ragResponse == null || ragResponse.chunks() == null || ragResponse.chunks().isEmpty() || includedCount <= 0) {
            return List.of();
        }
        List<RequestLogWriter.RetrievedDocumentInfo> infos = new ArrayList<>();
        for (int i = 0; i < ragResponse.chunks().size() && i < includedCount; i++) {
            var chunk = ragResponse.chunks().get(i);
            infos.add(new RequestLogWriter.RetrievedDocumentInfo(
                    chunk.documentName(),
                    chunk.score(),
                    chunk.content(),
                    null,
                    i + 1
            ));
        }
        return infos;
    }

    private static String resolveBusinessErrorMessage(BusinessException exception) {
        String message = exception.getMessage();
        if (message == null || message.isBlank()) {
            return exception.getErrorCode().getDefaultMessage();
        }
        return message;
    }

    private static String toBusinessErrorResponsePayload(BusinessException exception) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("errorCode", exception.getErrorCode().name());
            payload.put("status", exception.getErrorCode().getStatus().value());
            payload.put("type", "BUSINESS_EXCEPTION");
            return LOG_PAYLOAD_MAPPER.writeValueAsString(payload);
        } catch (Exception ignored) {
            return exception.getErrorCode().name();
        }
    }

    private record RequestPayloadForLog(
            String provider,
            String model,
            boolean ragEnabled,
            boolean hasSystemPrompt,
            int userTemplateLength,
            int modelConfigCount,
            int variablesCount,
            Long baseVersionId
    ) {
    }
}
