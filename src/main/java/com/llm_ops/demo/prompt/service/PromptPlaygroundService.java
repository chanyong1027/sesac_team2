package com.llm_ops.demo.prompt.service;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.gateway.log.service.RequestLogWriter;
import com.llm_ops.demo.gateway.pricing.ModelPricing;
import com.llm_ops.demo.gateway.service.LlmCallService;
import com.llm_ops.demo.gateway.service.LlmCallService.ModelConfigOverride;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
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
                "PLAYGROUND"));

        Integer ragLatencyMs = null;
        Integer ragChunksCount = null;
        Integer ragContextChars = null;
        Boolean ragContextTruncated = null;
        String ragContextHash = null;
        Integer ragTopK = null;
        Double ragSimilarityThreshold = null;

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
                RagSearchResponse ragResponse = ragSearchService.search(
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
                    ragSimilarityThreshold));

            return new PlaygroundRunResponse(
                    traceId,
                    answer,
                    usedModel,
                    new PlaygroundUsage(inputTokens, outputTokens, totalTokens, estimatedCost),
                    latencyMs,
                    LocalDateTime.now());

        } catch (BusinessException e) {
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
                    e.getMessage(),
                    "BUSINESS_EXCEPTION",
                    ragLatencyMs, ragChunksCount, ragContextChars,
                    ragContextTruncated, ragContextHash, ragTopK, ragSimilarityThreshold));
            throw e;
        } catch (Exception e) {
            requestLogWriter.markFail(requestId, new RequestLogWriter.FailUpdate(
                    ErrorCode.INTERNAL_SERVER_ERROR.getStatus().value(),
                    toLatencyMs(startedAtNanos),
                    promptId,
                    request.baseVersionId(),
                    request.provider() != null ? request.provider().name().toLowerCase() : null,
                    request.model(),
                    null,
                    false,
                    null, null, null, null, null,
                    ErrorCode.INTERNAL_SERVER_ERROR.name(),
                    "Unhandled exception",
                    "UNHANDLED_EXCEPTION",
                    ragLatencyMs, ragChunksCount, ragContextChars,
                    ragContextTruncated, ragContextHash, ragTopK, ragSimilarityThreshold));
            throw e;
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
}
