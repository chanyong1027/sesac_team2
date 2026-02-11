package com.llm_ops.demo.gateway.service;

import com.llm_ops.demo.budget.domain.BudgetScopeType;
import com.llm_ops.demo.budget.service.BudgetDecision;
import com.llm_ops.demo.budget.service.BudgetDecisionAction;
import com.llm_ops.demo.budget.service.BudgetGuardrailService;
import com.llm_ops.demo.budget.service.BudgetUsageService;
import com.llm_ops.demo.gateway.dto.GatewayChatRequest;
import com.llm_ops.demo.gateway.dto.GatewayChatResponse;
import com.llm_ops.demo.gateway.dto.GatewayChatUsage;
import com.llm_ops.demo.gateway.log.service.RequestLogWriter;
import com.llm_ops.demo.gateway.pricing.ModelPricing;
import com.llm_ops.demo.global.error.BusinessException;
import java.math.BigDecimal;
import com.llm_ops.demo.global.error.ErrorCode;
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
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;

import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeoutException;
import java.time.YearMonth;

/**
 * 게이트웨이의 핵심 비즈니스 로직을 처리하는 서비스 클래스입니다.
 * API 키 인증, 프롬프트 렌더링, Spring AI를 통한 LLM 호출을 총괄합니다.
 */
@Service
public class GatewayChatService {

    private static final String GATEWAY_CHAT_COMPLETIONS_PATH = "/v1/chat/completions";
    private static final String GATEWAY_HTTP_METHOD = "POST";
    private static final String RAG_CONTEXT_TEMPLATE = """
            다음은 질문과 관련된 참고 문서입니다:

            %s

            위 문서를 참고하여 다음 질문에 답변해주세요:

            """;

    private final OrganizationApiKeyAuthService organizationApiKeyAuthService;
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

    public GatewayChatService(
            OrganizationApiKeyAuthService organizationApiKeyAuthService,
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
            BudgetUsageService budgetUsageService) {
        this.organizationApiKeyAuthService = organizationApiKeyAuthService;
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
                request.isRagEnabled(),
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
        Long usedProviderCredentialId = null;
        String budgetFailReason = null;
        Long promptId = null;
        Long promptVersionId = null;
        YearMonth budgetMonth = budgetUsageService.currentUtcYearMonth();

        try {
            Workspace workspace = findWorkspace(organizationId, request.workspaceId());
            ActiveVersionResolution resolution = resolveActiveVersion(workspace, request.promptKey());
            PromptVersion activeVersion = resolution.version();
            promptId = resolution.promptId();
            promptVersionId = resolution.promptVersionId();

            String renderedUserPrompt = renderPrompt(resolveUserTemplate(activeVersion, request.promptKey()),
                    request.variables());
            String renderedSystemPrompt = renderOptionalTemplate(activeVersion.getSystemPrompt(), request.variables());

            String prompt = renderedSystemPrompt == null || renderedSystemPrompt.isBlank()
                    ? renderedUserPrompt
                    : renderedSystemPrompt + "\n\n" + renderedUserPrompt;

            ProviderType providerType = activeVersion.getProvider();
            String requestedModel = activeVersion.getModel();
            ProviderType secondaryProvider = activeVersion.getSecondaryProvider();
            String secondaryModel = activeVersion.getSecondaryModel();
            usedProvider = providerType;
            usedRequestedModel = requestedModel;

            // Workspace soft-limit 초과 시 Degrade(저가모델 강제 / 토큰캡 / RAG off 등)
            boolean ragEnabledEffective = request.isRagEnabled();
            String modelOverride = null;
            Integer maxOutputTokensOverride = null;
            BudgetDecision wsDecision = budgetGuardrailService.evaluateWorkspaceDegrade(
                    workspace.getId(),
                    providerType != null ? providerType.getValue() : null
            );
            if (wsDecision.action() == BudgetDecisionAction.DEGRADE && wsDecision.overrides() != null) {
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
                            resolveRagQuery(renderedUserPrompt, request.variables()),
                            new RagSearchOptions(
                                    ragSettings.topK(),
                                    ragSettings.similarityThreshold(),
                                    ragSettings.hybridEnabled(),
                                    ragSettings.rerankEnabled(),
                                    ragSettings.rerankTopN()
                            )
                    );
                    ragLatencyMs = toLatencyMs(ragStartedAtNanos);

                    if (ragResponse.chunks() != null && !ragResponse.chunks().isEmpty()) {
                        RagContextBuilder.RagContextResult result = ragContextBuilder.build(
                                ragResponse.chunks(),
                                ragSettings.maxChunks(),
                                ragSettings.maxContextChars()
                        );
                        ragChunksCount = result.chunksIncluded();
                        ragContextChars = result.contextChars();
                        ragContextTruncated = result.truncated();
                        ragContextHash = sha256HexOrNull(result.context());
                        prompt = String.format(RAG_CONTEXT_TEMPLATE, result.context()) + prompt;
                    }
                }
            }

            ChatResponse response;
            try {
                ResolvedProviderApiKey primaryKey = providerCredentialService.resolveApiKey(organizationId, providerType);
                usedProviderCredentialId = primaryKey.credentialId();

                BudgetDecision providerDecision = budgetGuardrailService.evaluateProviderCredential(primaryKey.credentialId());
                if (providerDecision.action() == BudgetDecisionAction.BLOCK) {
                    if (hasSecondaryModel(secondaryProvider, secondaryModel)) {
                        ResolvedProviderApiKey secondaryKey = providerCredentialService.resolveApiKey(organizationId, secondaryProvider);
                        BudgetDecision secondaryBudget = budgetGuardrailService.evaluateProviderCredential(secondaryKey.credentialId());
                        if (secondaryBudget.action() != BudgetDecisionAction.BLOCK) {
                            isFailover = true;
                            usedProvider = secondaryProvider;
                            usedProviderCredentialId = secondaryKey.credentialId();
                            // failover 시에도 workspace degrade를 provider 기준으로 재평가하여 cheap model 적용
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
                            response = llmCallService.callProvider(secondaryKey, secondaryModelEffective, prompt, secondaryMaxTokens);
                        } else {
                            budgetFailReason = "PROVIDER_BUDGET_EXCEEDED";
                            throw new BusinessException(ErrorCode.BUDGET_EXCEEDED, "예산 한도 초과로 요청이 차단되었습니다.");
                        }
                    } else {
                        budgetFailReason = "PROVIDER_BUDGET_EXCEEDED";
                        throw new BusinessException(ErrorCode.BUDGET_EXCEEDED, "예산 한도 초과로 요청이 차단되었습니다.");
                    }
                }

                response = llmCallService.callProvider(primaryKey, requestedModelEffective, prompt, maxOutputTokensOverride);
            } catch (Exception primaryException) {
                if (!hasSecondaryModel(secondaryProvider, secondaryModel)) {
                    throw primaryException;
                }
                if (!isRetryableException(primaryException)) {
                    throw primaryException;
                }
                // primary 실패 후 failover 시도 전, secondary 예산 확인
                ResolvedProviderApiKey secondaryKey = providerCredentialService.resolveApiKey(organizationId, secondaryProvider);
                BudgetDecision secondaryBudget = budgetGuardrailService.evaluateProviderCredential(secondaryKey.credentialId());
                if (secondaryBudget.action() == BudgetDecisionAction.BLOCK) {
                    // secondary를 사용할 수 없으면 primary 에러를 그대로 반환
                    throw primaryException;
                }

                isFailover = true;
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
                response = llmCallService.callProvider(secondaryKey, secondaryModelEffective, prompt, secondaryMaxTokens);
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
                    ragSimilarityThreshold));

            return GatewayChatResponse.from(
                    traceId,
                    answer,
                    isFailover,
                    usedModel,
                    usage);
        } catch (BusinessException e) {
            if (e.getErrorCode() == ErrorCode.BUDGET_EXCEEDED) {
                requestLogWriter.markBlocked(requestId, new RequestLogWriter.BlockUpdate(
                        e.getErrorCode().getStatus().value(),
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
                        e.getErrorCode().name(),
                        e.getMessage(),
                        budgetFailReason != null ? budgetFailReason : "BUDGET_EXCEEDED",
                        ragLatencyMs,
                        ragChunksCount,
                        ragContextChars,
                        ragContextTruncated,
                        ragContextHash,
                        ragTopK,
                        ragSimilarityThreshold));
            } else {
                requestLogWriter.markFail(requestId, new RequestLogWriter.FailUpdate(
                        e.getErrorCode().getStatus().value(),
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
                        e.getErrorCode().name(),
                        e.getMessage(),
                        "BUSINESS_EXCEPTION",
                        ragLatencyMs,
                        ragChunksCount,
                        ragContextChars,
                        ragContextTruncated,
                        ragContextHash,
                        ragTopK,
                        ragSimilarityThreshold));
            }
            throw e;
        } catch (Exception e) {
            requestLogWriter.markFail(requestId, new RequestLogWriter.FailUpdate(
                    ErrorCode.INTERNAL_SERVER_ERROR.getStatus().value(),
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
                    ErrorCode.INTERNAL_SERVER_ERROR.name(),
                    "Unhandled exception",
                    "UNHANDLED_EXCEPTION",
                    ragLatencyMs,
                    ragChunksCount,
                    ragContextChars,
                    ragContextTruncated,
                    ragContextHash,
                    ragTopK,
                    ragSimilarityThreshold));
            throw e;
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

    private boolean hasSecondaryModel(ProviderType secondaryProvider, String secondaryModel) {
        return secondaryProvider != null && secondaryModel != null && !secondaryModel.isBlank();
    }

    private boolean isRetryableException(Exception exception) {
        if (exception instanceof BusinessException) {
            return false;
        }
        Throwable current = exception;
        while (current != null) {
            if (current instanceof SocketTimeoutException
                    || current instanceof ConnectException
                    || current instanceof UnknownHostException
                    || current instanceof TimeoutException
                    || current instanceof ResourceAccessException) {
                return true;
            }
            if (current instanceof HttpStatusCodeException statusException) {
                if (statusException.getStatusCode().is5xxServerError()) {
                    return true;
                }
            }
            current = current.getCause();
        }
        return false;
    }

}
