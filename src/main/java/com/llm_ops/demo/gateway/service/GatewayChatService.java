package com.llm_ops.demo.gateway.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.llm_ops.demo.budget.domain.BudgetScopeType;
import com.llm_ops.demo.budget.service.BudgetDecision;
import com.llm_ops.demo.budget.service.BudgetDecisionAction;
import com.llm_ops.demo.budget.service.BudgetGuardrailService;
import com.llm_ops.demo.budget.service.BudgetUsageService;
import com.llm_ops.demo.gateway.config.GatewayReliabilityProperties;
import com.llm_ops.demo.gateway.dto.GatewayChatRequest;
import com.llm_ops.demo.gateway.dto.GatewayChatResponse;
import com.llm_ops.demo.gateway.service.LlmCallService.ModelConfigOverride;
import com.llm_ops.demo.gateway.dto.GatewayChatUsage;
import com.llm_ops.demo.gateway.log.service.RequestLogWriter;
import com.llm_ops.demo.gateway.pricing.ModelPricing;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.global.error.GatewayException;
import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.keys.service.OrganizationApiKeyAuthService;
import com.llm_ops.demo.keys.service.ProviderCredentialService;
import com.llm_ops.demo.keys.service.ProviderCredentialService.ResolvedProviderApiKey;
import com.llm_ops.demo.prompt.domain.PromptRelease;
import com.llm_ops.demo.prompt.domain.PromptStatus;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import com.llm_ops.demo.prompt.repository.PromptReleaseRepository;
import com.llm_ops.demo.prompt.repository.PromptRepository;
import com.llm_ops.demo.rag.dto.RagSearchResponse;
import com.llm_ops.demo.rag.service.RagContextBuilder;
import com.llm_ops.demo.rag.service.RagSearchService;
import com.llm_ops.demo.rag.service.RagSearchService.RagSearchOptions;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.domain.WorkspaceStatus;
import com.llm_ops.demo.workspace.repository.WorkspaceRepository;
import com.llm_ops.demo.workspace.service.WorkspaceRagSettingsService;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.YearMonth;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 게이트웨이의 핵심 비즈니스 로직을 처리하는 서비스 클래스입니다.
 * API 키 인증, 프롬프트 렌더링, Spring AI를 통한 LLM 호출을 총괄합니다.
 */
@Service
public class GatewayChatService {

    private static final String GATEWAY_CHAT_COMPLETIONS_PATH = "/v1/chat/completions";
    private static final String GATEWAY_HTTP_METHOD = "POST";
    private static final ObjectMapper REQUEST_PAYLOAD_MAPPER = new ObjectMapper();
    private static final long FAILOVER_GUARD_BUFFER_MS = 100L;
    private static final int PROVIDER_CALL_MAX_THREADS = 16;
    private static final AtomicInteger PROVIDER_CALL_THREAD_SEQUENCE = new AtomicInteger(1);
    static final ExecutorService PROVIDER_CALL_EXECUTOR = Executors.newFixedThreadPool(
            PROVIDER_CALL_MAX_THREADS,
            runnable -> {
                Thread thread = new Thread(runnable);
                thread.setName("gateway-provider-call-" + PROVIDER_CALL_THREAD_SEQUENCE.getAndIncrement());
                thread.setDaemon(true);
                return thread;
            }
    );
    private static final GatewayFailureClassifier FAILURE_CLASSIFIER = new GatewayFailureClassifier();
    private static final String RAG_CONTEXT_PREFIX = """
            다음은 질문과 관련된 참고 문서입니다:

            """;
    private static final String RAG_CONTEXT_SUFFIX = """

            위 문서를 참고하여 다음 질문에 답변해주세요:

            """;

    private final OrganizationApiKeyAuthService organizationApiKeyAuthService;
    private final GatewayReliabilityProperties gatewayReliabilityProperties;
    private final ProviderCredentialService providerCredentialService;
    private final LlmCallService llmCallService;
    private final RagSearchService ragSearchService;
    private final RagContextBuilder ragContextBuilder;
    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceRagSettingsService workspaceRagSettingsService;
    private final RequestLogWriter requestLogWriter;
    private final PromptRepository promptRepository;
    private final PromptReleaseRepository promptReleaseRepository;
    private final BudgetGuardrailService budgetGuardrailService;
    private final BudgetUsageService budgetUsageService;
    private final GatewayMetrics gatewayMetrics;

    public GatewayChatService(
            OrganizationApiKeyAuthService organizationApiKeyAuthService,
            GatewayReliabilityProperties gatewayReliabilityProperties,
            ProviderCredentialService providerCredentialService,
            LlmCallService llmCallService,
            @org.springframework.beans.factory.annotation.Autowired(required = false) RagSearchService ragSearchService,
            RagContextBuilder ragContextBuilder,
            WorkspaceRepository workspaceRepository,
            WorkspaceRagSettingsService workspaceRagSettingsService,
            RequestLogWriter requestLogWriter,
            PromptRepository promptRepository,
            PromptReleaseRepository promptReleaseRepository,
            BudgetGuardrailService budgetGuardrailService,
            BudgetUsageService budgetUsageService,
            GatewayMetrics gatewayMetrics) {
        this.organizationApiKeyAuthService = organizationApiKeyAuthService;
        this.gatewayReliabilityProperties = gatewayReliabilityProperties;
        this.providerCredentialService = providerCredentialService;
        this.llmCallService = llmCallService;
        this.ragSearchService = ragSearchService;
        this.ragContextBuilder = ragContextBuilder;
        this.workspaceRepository = workspaceRepository;
        this.workspaceRagSettingsService = workspaceRagSettingsService;
        this.requestLogWriter = requestLogWriter;
        this.promptRepository = promptRepository;
        this.promptReleaseRepository = promptReleaseRepository;
        this.budgetGuardrailService = budgetGuardrailService;
        this.budgetUsageService = budgetUsageService;
        this.gatewayMetrics = gatewayMetrics;
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
        long deadlineNanos = startedAtNanos + TimeUnit.MILLISECONDS.toNanos(gatewayReliabilityProperties.resolvedRequestTimeoutMs());

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
                request.isRagEnabled(),
                toRequestPayloadJson(request),
                "GATEWAY"));

        Integer ragLatencyMs = null;
        Integer ragChunksCount = null;
        Integer ragContextChars = null;
        Boolean ragContextTruncated = null;
        String ragContextHash = null;
        Integer ragTopK = null;
        Double ragSimilarityThreshold = null;
        ProviderType usedProvider = null;
        String usedRequestedModel = null;
        boolean isFailover = false;
        boolean failoverAttempted = false;
        Long usedProviderCredentialId = null;
        String budgetFailReason = null;
        GatewayFailureClassifier.GatewayFailure lastProviderFailure = null;
        Long promptId = null;
        Long promptVersionId = null;
        java.util.List<RequestLogWriter.RetrievedDocumentInfo> retrievedDocumentInfos = null;
        YearMonth budgetMonth = budgetUsageService.currentUtcYearMonth();
        boolean ragEnabledEffective = request.isRagEnabled();
        long providerCallStartNanos = 0;
        long providerCallEndNanos = 0;

        try {
            Workspace workspace = findWorkspace(organizationId, request.workspaceId());
            ActiveVersionResolution resolution = resolveActiveVersion(workspace, request.promptKey());
            PromptVersion activeVersion = resolution.version();
            promptId = resolution.promptId();
            promptVersionId = resolution.promptVersionId();

            String userPrompt = renderPrompt(resolveUserTemplate(activeVersion, request.promptKey()),
                    request.variables());
            String systemPrompt = renderOptionalTemplate(activeVersion.getSystemPrompt(), request.variables());

            ProviderType providerType = activeVersion.getProvider();
            String requestedModel = activeVersion.getModel();
            ProviderType secondaryProvider = activeVersion.getSecondaryProvider();
            String secondaryModel = activeVersion.getSecondaryModel();
            usedProvider = providerType;
            usedRequestedModel = requestedModel;

            // Workspace soft-limit 초과 시 Degrade(저가모델 강제 / 토큰캡 / RAG off 등)
            ragEnabledEffective = request.isRagEnabled();
            String modelOverride = null;
            Integer maxOutputTokensOverride = null;
            long wsBudgetStartNanos = System.nanoTime();
            BudgetDecision wsDecision = budgetGuardrailService.evaluateWorkspaceDegrade(
                    workspace.getId(),
                    providerType != null ? providerType.getValue() : null
            );
            gatewayMetrics.recordBudgetEval("workspace", System.nanoTime() - wsBudgetStartNanos);
            if (wsDecision.action() == BudgetDecisionAction.DEGRADE && wsDecision.overrides() != null) {
                gatewayMetrics.incrementBudgetDegrade("WORKSPACE");
                BudgetDecision.Overrides o = wsDecision.overrides();
                if (o.modelOverride() != null && !o.modelOverride().isBlank()) {
                    modelOverride = o.modelOverride();
                }
                if (o.maxOutputTokens() != null && o.maxOutputTokens() > 0) {
                    maxOutputTokensOverride = o.maxOutputTokens();
                }
                if (Boolean.TRUE.equals(o.disableRag())) {
                    ragEnabledEffective = false;
                }
            }

            String requestedModelEffective = (modelOverride != null ? modelOverride : requestedModel);
            usedRequestedModel = requestedModelEffective;

            if (ragEnabledEffective) {
                ragChunksCount = 0;
                ragContextChars = 0;
                ragContextTruncated = false;
                ragLatencyMs = 0;

                if (ragSearchService != null) {
                    WorkspaceRagSettingsService.RagRuntimeSettings ragSettings =
                            workspaceRagSettingsService.resolveRuntimeSettings(workspace.getId());
                    ragTopK = ragSettings.topK();
                    ragSimilarityThreshold = ragSettings.similarityThreshold();
                    long ragStartedAtNanos = System.nanoTime();
                    RagSearchResponse ragResponse = ragSearchService.search(
                            request.workspaceId(),
                            resolveRagQuery(userPrompt, request.variables()),
                            new RagSearchOptions(
                                    ragSettings.topK(),
                                    ragSettings.similarityThreshold(),
                                    ragSettings.hybridEnabled(),
                                    ragSettings.rerankEnabled(),
                                    ragSettings.rerankTopN()
                            )
                    );
                    long ragElapsedNanos = System.nanoTime() - ragStartedAtNanos;
                    ragLatencyMs = toLatencyMs(ragStartedAtNanos);
                    gatewayMetrics.recordRagSearch(ragSettings.hybridEnabled(), ragElapsedNanos);

                    if (ragResponse.chunks() != null && !ragResponse.chunks().isEmpty()) {
                        RagContextBuilder.RagContextResult result = ragContextBuilder.build(
                                ragResponse.chunks(),
                                ragSettings.maxChunks(),
                                ragSettings.maxContextChars()
                        );
                        ragChunksCount = result.chunksIncluded();
                        gatewayMetrics.recordRagChunks(ragChunksCount);
                        ragContextChars = result.contextChars();
                        ragContextTruncated = result.truncated();
                        ragContextHash = sha256HexOrNull(result.context());
                        retrievedDocumentInfos = new java.util.ArrayList<>();
                        for (int i = 0; i < ragResponse.chunks().size() && i < result.chunksIncluded(); i++) {
                            var chunk = ragResponse.chunks().get(i);
                            retrievedDocumentInfos.add(new RequestLogWriter.RetrievedDocumentInfo(
                                    chunk.documentName(),
                                    chunk.score(),
                                    chunk.content(),
                                    null,
                                    i + 1));
                        }
                        userPrompt = RAG_CONTEXT_PREFIX + result.context() + RAG_CONTEXT_SUFFIX + userPrompt;
                    }
                }
            }

            ChatResponse response;
            ResolvedProviderApiKey primaryKey = providerCredentialService.resolveApiKey(organizationId, providerType);
            usedProviderCredentialId = primaryKey.credentialId();

            long provBudgetStartNanos = System.nanoTime();
            BudgetDecision providerDecision = budgetGuardrailService.evaluateProviderCredential(primaryKey.credentialId());
            gatewayMetrics.recordBudgetEval("provider_credential", System.nanoTime() - provBudgetStartNanos);
            if (providerDecision.action() == BudgetDecisionAction.BLOCK) {
                if (!hasSecondaryModel(secondaryProvider, secondaryModel)) {
                    gatewayMetrics.incrementBudgetBlocked("PROVIDER_CREDENTIAL");
                    budgetFailReason = "PROVIDER_BUDGET_EXCEEDED";
                    throw new BusinessException(ErrorCode.BUDGET_EXCEEDED, "예산 한도 초과로 요청이 차단되었습니다.");
                }
                ResolvedProviderApiKey secondaryKey = providerCredentialService.resolveApiKey(organizationId, secondaryProvider);
                BudgetDecision secondaryBudget = budgetGuardrailService.evaluateProviderCredential(secondaryKey.credentialId());
                if (secondaryBudget.action() == BudgetDecisionAction.BLOCK) {
                    gatewayMetrics.incrementBudgetBlocked("PROVIDER_CREDENTIAL");
                    budgetFailReason = "PROVIDER_BUDGET_EXCEEDED";
                    throw new BusinessException(ErrorCode.BUDGET_EXCEEDED, "예산 한도 초과로 요청이 차단되었습니다.");
                }
                if (!hasRemainingBudget(deadlineNanos, gatewayReliabilityProperties.resolvedMinFailoverBudgetMs())) {
                    lastProviderFailure = FAILURE_CLASSIFIER.requestDeadlineExhaustedFailure();
                    throw new RequestDeadlineExhaustedException();
                }

                isFailover = true;
                failoverAttempted = true;
                gatewayMetrics.incrementFailover(
                        providerType != null ? providerType.name().toLowerCase() : "unknown",
                        secondaryProvider != null ? secondaryProvider.name().toLowerCase() : "unknown");
                usedProvider = secondaryProvider;
                usedProviderCredentialId = secondaryKey.credentialId();

                BudgetDecision wsDecisionSecondary = budgetGuardrailService.evaluateWorkspaceDegrade(
                        workspace.getId(),
                        secondaryProvider != null ? secondaryProvider.getValue() : null
                );
                String secondaryOverride = null;
                Integer secondaryMaxTokens = maxOutputTokensOverride;
                if (wsDecisionSecondary.action() == BudgetDecisionAction.DEGRADE && wsDecisionSecondary.overrides() != null) {
                    BudgetDecision.Overrides o2 = wsDecisionSecondary.overrides();
                    if (o2.modelOverride() != null && !o2.modelOverride().isBlank()) {
                        secondaryOverride = o2.modelOverride();
                    }
                    if (o2.maxOutputTokens() != null && o2.maxOutputTokens() > 0) {
                        secondaryMaxTokens = o2.maxOutputTokens();
                    }
                }
                String secondaryModelEffective = secondaryOverride != null ? secondaryOverride : secondaryModel;
                usedRequestedModel = secondaryModelEffective;

                providerCallStartNanos = System.nanoTime();
                ProviderCallOutcome secondaryOutcome = callProviderWithPolicy(
                        secondaryKey,
                        secondaryModelEffective,
                        systemPrompt,
                        userPrompt,
                        secondaryMaxTokens,
                        deadlineNanos,
                        false
                );
                if (!secondaryOutcome.success()) {
                    lastProviderFailure = secondaryOutcome.failure();
                    throw secondaryOutcome.exception();
                }
                response = secondaryOutcome.response();
                providerCallEndNanos = System.nanoTime();
            } else {
                providerCallStartNanos = System.nanoTime();
                ProviderCallOutcome primaryOutcome = callProviderWithPolicy(
                        primaryKey,
                        requestedModelEffective,
                        systemPrompt,
                        userPrompt,
                        maxOutputTokensOverride,
                        deadlineNanos,
                        hasSecondaryModel(secondaryProvider, secondaryModel)
                );
                if (primaryOutcome.success()) {
                    response = primaryOutcome.response();
                    providerCallEndNanos = System.nanoTime();
                } else {
                    lastProviderFailure = primaryOutcome.failure();
                    RuntimeException primaryException = primaryOutcome.exception();
                    if (!hasSecondaryModel(secondaryProvider, secondaryModel) || !lastProviderFailure.failoverEligible()) {
                        throw primaryException;
                    }
                    if (!hasRemainingBudget(deadlineNanos, gatewayReliabilityProperties.resolvedMinFailoverBudgetMs())) {
                        lastProviderFailure = FAILURE_CLASSIFIER.requestDeadlineExhaustedFailure();
                        throw new RequestDeadlineExhaustedException();
                    }

                    ResolvedProviderApiKey secondaryKey = providerCredentialService.resolveApiKey(organizationId, secondaryProvider);
                    BudgetDecision secondaryBudget = budgetGuardrailService.evaluateProviderCredential(secondaryKey.credentialId());
                    if (secondaryBudget.action() == BudgetDecisionAction.BLOCK) {
                        throw primaryException;
                    }

                    isFailover = true;
                    failoverAttempted = true;
                    gatewayMetrics.incrementFailover(
                            providerType != null ? providerType.name().toLowerCase() : "unknown",
                            secondaryProvider != null ? secondaryProvider.name().toLowerCase() : "unknown");
                    usedProvider = secondaryProvider;
                    usedProviderCredentialId = secondaryKey.credentialId();

                    BudgetDecision wsDecisionSecondary = budgetGuardrailService.evaluateWorkspaceDegrade(
                            workspace.getId(),
                            secondaryProvider != null ? secondaryProvider.getValue() : null
                    );
                    String secondaryOverride = null;
                    Integer secondaryMaxTokens = maxOutputTokensOverride;
                    if (wsDecisionSecondary.action() == BudgetDecisionAction.DEGRADE && wsDecisionSecondary.overrides() != null) {
                        BudgetDecision.Overrides o2 = wsDecisionSecondary.overrides();
                        if (o2.modelOverride() != null && !o2.modelOverride().isBlank()) {
                            secondaryOverride = o2.modelOverride();
                        }
                        if (o2.maxOutputTokens() != null && o2.maxOutputTokens() > 0) {
                            secondaryMaxTokens = o2.maxOutputTokens();
                        }
                    }
                    String secondaryModelEffective = secondaryOverride != null ? secondaryOverride : secondaryModel;
                    usedRequestedModel = secondaryModelEffective;

                    providerCallStartNanos = System.nanoTime();
                    ProviderCallOutcome secondaryOutcome = callProviderWithPolicy(
                            secondaryKey,
                            secondaryModelEffective,
                            systemPrompt,
                            userPrompt,
                            secondaryMaxTokens,
                            deadlineNanos,
                            false
                    );
                    if (!secondaryOutcome.success()) {
                        lastProviderFailure = secondaryOutcome.failure();
                        throw secondaryOutcome.exception();
                    }
                    response = secondaryOutcome.response();
                    providerCallEndNanos = System.nanoTime();
                }
            }

            String answer = response.getResult().getOutput().getText();
            String usedModel = response.getMetadata() != null ? response.getMetadata().getModel() : null;

            // 토큰 정보 추출 (로그 저장 및 비용 계산용)
            Integer inputTokens = null;
            Integer outputTokens = null;
            Integer totalTokens = null;
            BigDecimal estimatedCost = null;

            if (response.getMetadata() != null && response.getMetadata().getUsage() != null) {
                inputTokens = safeToInteger(response.getMetadata().getUsage().getPromptTokens());
                outputTokens = safeToInteger(response.getMetadata().getUsage().getGenerationTokens());
                totalTokens = safeToInteger(response.getMetadata().getUsage().getTotalTokens());
            }

            // 일부 프로바이더는 totalTokens만 반환하거나, input/output 일부만 반환합니다.
            if (totalTokens == null && inputTokens != null && outputTokens != null) {
                long sum = (long) inputTokens + (long) outputTokens;
                totalTokens = sum > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) sum;
            }
            if (totalTokens != null) {
                if (inputTokens != null && outputTokens == null) {
                    int computed = totalTokens - inputTokens;
                    if (computed >= 0) {
                        outputTokens = computed;
                    }
                } else if (outputTokens != null && inputTokens == null) {
                    int computed = totalTokens - outputTokens;
                    if (computed >= 0) {
                        inputTokens = computed;
                    }
                }
            }

            String pricingModel = usedModel != null ? usedModel : usedRequestedModel;
            if (inputTokens != null && outputTokens != null) {
                estimatedCost = ModelPricing.calculateCost(pricingModel, inputTokens, outputTokens);
            } else if (totalTokens != null) {
                estimatedCost = ModelPricing.calculateCostFromTotalTokens(pricingModel, totalTokens);
            }

            // API 응답용 DTO (클라이언트에게는 총 토큰과 비용만 전달)
            GatewayChatUsage usage = new GatewayChatUsage(
                    totalTokens != null ? totalTokens.longValue() : null,
                    estimatedCost);

            // 예산 집계는 로그 async에 의존하지 않고 요청 스레드에서 동기 기록합니다.
            budgetUsageService.recordUsage(
                    BudgetScopeType.WORKSPACE,
                    request.workspaceId(),
                    budgetMonth,
                    estimatedCost,
                    totalTokens != null ? totalTokens.longValue() : null
            );
            budgetUsageService.recordUsage(
                    BudgetScopeType.PROVIDER_CREDENTIAL,
                    usedProviderCredentialId,
                    budgetMonth,
                    estimatedCost,
                    totalTokens != null ? totalTokens.longValue() : null
            );

            requestLogWriter.markSuccess(requestId, new RequestLogWriter.SuccessUpdate(
                    200,
                    toLatencyMs(startedAtNanos),
                    promptId,
                    promptVersionId,
                    usedProvider != null ? usedProvider.name().toLowerCase() : null,
                    usedRequestedModel,
                    usedModel,
                    isFailover,
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
                    retrievedDocumentInfos));

            // ── Metrics: success path ──
            String providerTag = usedProvider != null ? usedProvider.name().toLowerCase() : "unknown";
            gatewayMetrics.recordRequest(providerTag, usedRequestedModel, ragEnabledEffective, isFailover, "success", System.nanoTime() - startedAtNanos);
            gatewayMetrics.recordLlmCall(providerTag, usedRequestedModel, ragEnabledEffective, isFailover, "success", providerCallEndNanos - providerCallStartNanos);
            gatewayMetrics.incrementLlmSuccess(providerTag, usedRequestedModel);
            if (inputTokens != null) {
                gatewayMetrics.recordInputTokens(providerTag, usedRequestedModel, inputTokens);
            }
            if (outputTokens != null) {
                gatewayMetrics.recordOutputTokens(providerTag, usedRequestedModel, outputTokens);
            }

            return GatewayChatResponse.from(
                    traceId,
                    answer,
                    isFailover,
                    usedModel,
                    usage);
        } catch (BusinessException e) {
            String providerTag = usedProvider != null ? usedProvider.name().toLowerCase() : "unknown";
            String failReason = budgetFailReason != null ? budgetFailReason : e.getErrorCode().name();
            gatewayMetrics.recordRequest(providerTag, usedRequestedModel, ragEnabledEffective, isFailover, "error", System.nanoTime() - startedAtNanos);
            if (providerCallStartNanos > 0) {
                gatewayMetrics.recordLlmCall(providerTag, usedRequestedModel, ragEnabledEffective, isFailover, "error", System.nanoTime() - providerCallStartNanos);
                gatewayMetrics.incrementLlmFailure(providerTag, usedRequestedModel, failReason);
            }
            GatewayFailureClassifier.GatewayFailure gatewayFailure = classifyBusinessFailure(e, budgetFailReason);
            if (e.getErrorCode() == ErrorCode.BUDGET_EXCEEDED) {
                requestLogWriter.markBlocked(requestId, new RequestLogWriter.BlockUpdate(
                        gatewayFailure.httpStatus(),
                        toLatencyMs(startedAtNanos),
                        promptId,
                        promptVersionId,
                        usedProvider != null ? usedProvider.name().toLowerCase() : null,
                        usedRequestedModel,
                        null,
                        isFailover,
                        null,
                        null,
                        null,
                        null, // cost
                        null, // version
                        gatewayFailure.errorCode(),
                        gatewayFailure.errorMessage(),
                        gatewayFailure.failReason(),
                        ragLatencyMs,
                        ragChunksCount,
                        ragContextChars,
                        ragContextTruncated,
                        ragContextHash,
                        ragTopK,
                        ragSimilarityThreshold,
                        toErrorResponsePayload(gatewayFailure),
                        retrievedDocumentInfos));
            } else {
                requestLogWriter.markFail(requestId, new RequestLogWriter.FailUpdate(
                        gatewayFailure.httpStatus(),
                        toLatencyMs(startedAtNanos),
                        promptId,
                        promptVersionId,
                        usedProvider != null ? usedProvider.name().toLowerCase() : null,
                        usedRequestedModel,
                        null,
                        isFailover,
                        null,
                        null,
                        null,
                        null, // cost
                        null, // version
                        gatewayFailure.errorCode(),
                        gatewayFailure.errorMessage(),
                        gatewayFailure.failReason(),
                        ragLatencyMs,
                        ragChunksCount,
                        ragContextChars,
                        ragContextTruncated,
                        ragContextHash,
                        ragTopK,
                        ragSimilarityThreshold,
                        toErrorResponsePayload(gatewayFailure),
                        retrievedDocumentInfos));
            }
            throw toGatewayException(gatewayFailure, e);
        } catch (Exception e) {
            String providerTag = usedProvider != null ? usedProvider.name().toLowerCase() : "unknown";
            String exFailReason = lastProviderFailure != null ? lastProviderFailure.failReason() : e.getClass().getSimpleName();
            gatewayMetrics.recordRequest(providerTag, usedRequestedModel, ragEnabledEffective, isFailover, "error", System.nanoTime() - startedAtNanos);
            if (providerCallStartNanos > 0) {
                gatewayMetrics.recordLlmCall(providerTag, usedRequestedModel, ragEnabledEffective, isFailover, "error", System.nanoTime() - providerCallStartNanos);
                gatewayMetrics.incrementLlmFailure(providerTag, usedRequestedModel, exFailReason);
            }
            GatewayFailureClassifier.GatewayFailure gatewayFailure;
            if (isRequestDeadlineFailure(lastProviderFailure)) {
                gatewayFailure = lastProviderFailure;
            } else if (failoverAttempted) {
                gatewayFailure = allProvidersFailedFailure(lastProviderFailure);
            } else {
                gatewayFailure = lastProviderFailure != null ? lastProviderFailure : classifyProviderFailure(e);
            }
            requestLogWriter.markFail(requestId, new RequestLogWriter.FailUpdate(
                    gatewayFailure.httpStatus(),
                    toLatencyMs(startedAtNanos),
                    promptId,
                    promptVersionId,
                    usedProvider != null ? usedProvider.name().toLowerCase() : null,
                    usedRequestedModel,
                    null,
                    isFailover,
                    null,
                    null,
                    null,
                    null, // cost
                    null, // version
                    gatewayFailure.errorCode(),
                    gatewayFailure.errorMessage(),
                    gatewayFailure.failReason(),
                    ragLatencyMs,
                    ragChunksCount,
                    ragContextChars,
                    ragContextTruncated,
                    ragContextHash,
                    ragTopK,
                    ragSimilarityThreshold,
                    toErrorResponsePayload(gatewayFailure),
                    retrievedDocumentInfos));
            throw toGatewayException(gatewayFailure, e);
        }
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

    private record ActiveVersionResolution(Long promptId, Long promptVersionId, PromptVersion version) {
    }

    private ActiveVersionResolution resolveActiveVersion(Workspace workspace, String promptKey) {
        com.llm_ops.demo.prompt.domain.Prompt promptEntity = promptRepository
                .findByWorkspaceAndPromptKeyAndStatus(workspace, promptKey, PromptStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "프롬프트를 찾을 수 없습니다."));
        PromptRelease release = promptReleaseRepository.findWithActiveVersionByPromptId(promptEntity.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "릴리즈된 버전이 없습니다."));
        PromptVersion activeVersion = release.getActiveVersion();
        return new ActiveVersionResolution(promptEntity.getId(), activeVersion.getId(), activeVersion);
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

    private String resolveRagQuery(String renderedUserPrompt, Map<String, String> variables) {
        if (variables != null) {
            String question = variables.get("question");
            if (question != null && !question.isBlank()) {
                return question;
            }
        }
        return renderedUserPrompt;
    }

    private static String toRequestPayloadJson(GatewayChatRequest request) {
        if (request == null) {
            return null;
        }
        try {
            RequestPayloadForLog payload = new RequestPayloadForLog(
                    request.workspaceId(),
                    request.promptKey(),
                    request.isRagEnabled(),
                    request.variables() != null ? request.variables().size() : 0
            );
            return REQUEST_PAYLOAD_MAPPER.writeValueAsString(payload);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static String toErrorResponsePayload(GatewayFailureClassifier.GatewayFailure gatewayFailure) {
        if (gatewayFailure == null) {
            return null;
        }
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("errorCode", gatewayFailure.errorCode());
            payload.put("message", gatewayFailure.errorMessage());
            payload.put("httpStatus", gatewayFailure.httpStatus());
            payload.put("failReason", gatewayFailure.failReason());
            return REQUEST_PAYLOAD_MAPPER.writeValueAsString(payload);
        } catch (Exception ignored) {
            return gatewayFailure.errorCode();
        }
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
            rendered = rendered.replace(doubleBrace, value);
        }
        return rendered;
    }

    // ── Provider 호출 체인 ──────────────────────────────────────────────────

    /**
     * LlmCallService에 위임하여 실제 LLM 프로바이더를 호출합니다.
     */
    private ChatResponse callProvider(
            ResolvedProviderApiKey resolved,
            String requestedModel,
            String systemPrompt,
            String userPrompt,
            Integer maxOutputTokensOverride
    ) {
        return llmCallService.callProvider(
                resolved,
                requestedModel,
                systemPrompt,
                userPrompt,
                ModelConfigOverride.ofMaxTokens(maxOutputTokensOverride)
        );
    }

    private boolean hasSecondaryModel(ProviderType secondaryProvider, String secondaryModel) {
        return secondaryProvider != null && secondaryModel != null && !secondaryModel.isBlank();
    }

    private boolean isRetryableException(Exception exception) {
        return classifyProviderFailure(exception).failoverEligible();
    }

    private ProviderCallOutcome callProviderWithPolicy(
            ResolvedProviderApiKey resolved,
            String requestedModel,
            String systemPrompt,
            String userPrompt,
            Integer maxOutputTokensOverride,
            long deadlineNanos,
            boolean reserveFailoverBudget
    ) {
        long failoverReserveMs = reserveFailoverBudget
                ? gatewayReliabilityProperties.resolvedMinFailoverBudgetMs() + FAILOVER_GUARD_BUFFER_MS
                : 0L;
        try {
            ChatResponse first = callProviderWithDeadline(
                    resolved,
                    requestedModel,
                    systemPrompt,
                    userPrompt,
                    maxOutputTokensOverride,
                    deadlineNanos,
                    failoverReserveMs
            );
            return ProviderCallOutcome.success(first);
        } catch (Exception firstException) {
            GatewayFailureClassifier.GatewayFailure firstFailure = classifyProviderFailure(firstException);
            if (!firstFailure.retrySameRouteOnce()) {
                return ProviderCallOutcome.failure(toRuntimeException(firstException), firstFailure);
            }
            long minimumRetryBudgetMs = gatewayReliabilityProperties.resolvedMinRetryBudgetMs() + failoverReserveMs;
            if (!hasRemainingBudget(deadlineNanos, minimumRetryBudgetMs)) {
                return ProviderCallOutcome.failure(toRuntimeException(firstException), firstFailure);
            }

            long retryBackoffMs = gatewayReliabilityProperties.resolvedRetryBackoffMs();
            if (retryBackoffMs > 0) {
                long maxSleepMs = Math.max(0L, remainingBudgetMs(deadlineNanos) - failoverReserveMs);
                sleepQuietly(Math.min(retryBackoffMs, maxSleepMs));
            }
            if (!hasRemainingBudget(deadlineNanos, minimumRetryBudgetMs)) {
                return ProviderCallOutcome.failure(toRuntimeException(firstException), firstFailure);
            }
            try {
                ChatResponse second = callProviderWithDeadline(
                        resolved,
                        requestedModel,
                        systemPrompt,
                        userPrompt,
                        maxOutputTokensOverride,
                        deadlineNanos,
                        failoverReserveMs
                );
                return ProviderCallOutcome.success(second);
            } catch (Exception secondException) {
                GatewayFailureClassifier.GatewayFailure secondFailure = classifyProviderFailure(secondException);
                return ProviderCallOutcome.failure(toRuntimeException(secondException), secondFailure);
            }
        }
    }

    private GatewayFailureClassifier.GatewayFailure classifyProviderFailure(Exception exception) {
        if (exception instanceof RequestDeadlineExhaustedException) {
            return FAILURE_CLASSIFIER.requestDeadlineExhaustedFailure();
        }
        if (exception instanceof ProviderAttemptTimeoutException) {
            return FAILURE_CLASSIFIER.requestDeadlineExceededFailure();
        }
        return FAILURE_CLASSIFIER.classifyProvider(exception);
    }

    private ChatResponse callProviderWithDeadline(
            ResolvedProviderApiKey resolved,
            String requestedModel,
            String systemPrompt,
            String userPrompt,
            Integer maxOutputTokensOverride,
            long deadlineNanos,
            long reservedBudgetAfterCallMs
    ) throws Exception {
        long remainingMs = remainingBudgetMs(deadlineNanos);
        long usableBudgetMs = remainingMs - Math.max(0L, reservedBudgetAfterCallMs);
        if (usableBudgetMs <= 0) {
            throw new RequestDeadlineExhaustedException();
        }

        long attemptTimeoutMs = Math.max(1L, usableBudgetMs);
        Future<ChatResponse> future = PROVIDER_CALL_EXECUTOR.submit(() ->
                callProvider(resolved, requestedModel, systemPrompt, userPrompt, maxOutputTokensOverride));

        try {
            return future.get(attemptTimeoutMs, TimeUnit.MILLISECONDS);
        } catch (TimeoutException timeoutException) {
            future.cancel(true);
            throw new ProviderAttemptTimeoutException(timeoutException);
        } catch (InterruptedException interruptedException) {
            future.cancel(true);
            Thread.currentThread().interrupt();
            throw new ProviderAttemptTimeoutException(interruptedException);
        } catch (ExecutionException executionException) {
            Throwable cause = executionException.getCause();
            if (cause instanceof Exception providerException) {
                throw providerException;
            }
            throw new RuntimeException(cause);
        }
    }

    // ── 실패 분류 / 에러 처리 ────────────────────────────────────────────────

    private GatewayFailureClassifier.GatewayFailure classifyBusinessFailure(BusinessException exception, String budgetFailReason) {
        String overrideReason = exception.getErrorCode() == ErrorCode.BUDGET_EXCEEDED
                ? (budgetFailReason != null ? budgetFailReason : "BUDGET_EXCEEDED")
                : null;
        return FAILURE_CLASSIFIER.classifyBusiness(exception, overrideReason);
    }

    private GatewayFailureClassifier.GatewayFailure allProvidersFailedFailure(
            GatewayFailureClassifier.GatewayFailure lastProviderFailure
    ) {
        String detailedReason;
        if (lastProviderFailure != null && lastProviderFailure.failReason() != null && !lastProviderFailure.failReason().isBlank()) {
            detailedReason = "ALL_FAILED_" + lastProviderFailure.failReason();
        } else {
            detailedReason = "ALL_PROVIDERS_FAILED";
        }
        return new GatewayFailureClassifier.GatewayFailure(
                "GW-GW-ALL_PROVIDERS_FAILED",
                detailedReason,
                "모든 프로바이더 경로에서 요청이 실패했습니다.",
                502,
                GatewayFailureClassifier.FailoverPolicy.FAIL_FAST
        );
    }

    private boolean hasRemainingBudget(long deadlineNanos, long minimumRequiredMs) {
        return remainingBudgetMs(deadlineNanos) >= minimumRequiredMs;
    }

    private long remainingBudgetMs(long deadlineNanos) {
        long remainingNanos = deadlineNanos - System.nanoTime();
        if (remainingNanos <= 0) {
            return 0L;
        }
        return TimeUnit.NANOSECONDS.toMillis(remainingNanos);
    }

    private boolean isRequestDeadlineFailure(GatewayFailureClassifier.GatewayFailure gatewayFailure) {
        return gatewayFailure != null && "REQUEST_DEADLINE_EXCEEDED".equals(gatewayFailure.failReason());
    }

    private GatewayException toGatewayException(
            GatewayFailureClassifier.GatewayFailure gatewayFailure,
            Exception cause
    ) {
        HttpStatus status = HttpStatus.resolve(gatewayFailure.httpStatus());
        if (status == null) {
            status = HttpStatus.BAD_GATEWAY;
        }
        return new GatewayException(
                gatewayFailure.errorCode(),
                status,
                gatewayFailure.errorMessage(),
                cause
        );
    }

    private static void sleepQuietly(long millis) {
        if (millis <= 0) {
            return;
        }
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
    }

    private static RuntimeException toRuntimeException(Exception exception) {
        if (exception instanceof RuntimeException runtimeException) {
            return runtimeException;
        }
        return new RuntimeException(exception);
    }

    private record ProviderCallOutcome(
            ChatResponse response,
            RuntimeException exception,
            GatewayFailureClassifier.GatewayFailure failure
    ) {
        static ProviderCallOutcome success(ChatResponse response) {
            return new ProviderCallOutcome(response, null, null);
        }

        static ProviderCallOutcome failure(RuntimeException exception, GatewayFailureClassifier.GatewayFailure failure) {
            return new ProviderCallOutcome(null, exception, failure);
        }

        boolean success() {
            return response != null;
        }
    }

    private static final class RequestDeadlineExhaustedException extends RuntimeException {
    }

    private static final class ProviderAttemptTimeoutException extends RuntimeException {
        private ProviderAttemptTimeoutException(Throwable cause) {
            super(cause);
        }
    }

    private record RequestPayloadForLog(
            Long workspaceId,
            String promptKey,
            boolean ragEnabled,
            int variablesCount
    ) {
    }
}
