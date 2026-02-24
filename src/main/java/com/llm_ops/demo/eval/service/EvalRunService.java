package com.llm_ops.demo.eval.service;

import com.llm_ops.demo.eval.config.EvalProperties;
import com.llm_ops.demo.eval.domain.EvalCaseResult;
import com.llm_ops.demo.eval.domain.EvalMode;
import com.llm_ops.demo.eval.domain.EvalRun;
import com.llm_ops.demo.eval.domain.EvalRunStatus;
import com.llm_ops.demo.eval.domain.EvalTriggerType;
import com.llm_ops.demo.eval.domain.PromptEvalDefault;
import com.llm_ops.demo.eval.dto.EvalCancelResponse;
import com.llm_ops.demo.eval.dto.EvalCaseResultListResponse;
import com.llm_ops.demo.eval.dto.EvalCaseResultResponse;
import com.llm_ops.demo.eval.dto.EvalRunCreateRequest;
import com.llm_ops.demo.eval.dto.EvalRunEstimateRequest;
import com.llm_ops.demo.eval.dto.EvalRunEstimateResponse;
import com.llm_ops.demo.eval.dto.EvalRunResponse;
import com.llm_ops.demo.eval.repository.EvalCaseResultRepository;
import com.llm_ops.demo.eval.repository.EvalRunRepository;
import com.llm_ops.demo.eval.repository.EvalTestCaseRepository;
import com.llm_ops.demo.eval.repository.PromptEvalDefaultRepository;
import com.llm_ops.demo.gateway.pricing.ModelPricing;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptStatus;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import com.llm_ops.demo.prompt.repository.PromptReleaseRepository;
import com.llm_ops.demo.prompt.repository.PromptRepository;
import com.llm_ops.demo.prompt.repository.PromptVersionRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EvalRunService {

    private static final Logger log = LoggerFactory.getLogger(EvalRunService.class);

    private final EvalAccessService evalAccessService;
    private final EvalProperties evalProperties;
    private final EvalRunRepository evalRunRepository;
    private final EvalCaseResultRepository evalCaseResultRepository;
    private final EvalTestCaseRepository evalTestCaseRepository;
    private final PromptEvalDefaultRepository promptEvalDefaultRepository;
    private final PromptReleaseRepository promptReleaseRepository;
    private final PromptRepository promptRepository;
    private final PromptVersionRepository promptVersionRepository;

    public EvalRunService(
            EvalAccessService evalAccessService,
            EvalProperties evalProperties,
            EvalRunRepository evalRunRepository,
            EvalCaseResultRepository evalCaseResultRepository,
            EvalTestCaseRepository evalTestCaseRepository,
            PromptEvalDefaultRepository promptEvalDefaultRepository,
            PromptReleaseRepository promptReleaseRepository,
            PromptRepository promptRepository,
            PromptVersionRepository promptVersionRepository
    ) {
        this.evalAccessService = evalAccessService;
        this.evalProperties = evalProperties;
        this.evalRunRepository = evalRunRepository;
        this.evalCaseResultRepository = evalCaseResultRepository;
        this.evalTestCaseRepository = evalTestCaseRepository;
        this.promptEvalDefaultRepository = promptEvalDefaultRepository;
        this.promptReleaseRepository = promptReleaseRepository;
        this.promptRepository = promptRepository;
        this.promptVersionRepository = promptVersionRepository;
    }

    @Transactional
    public EvalRunResponse createRun(Long workspaceId, Long promptId, Long userId, EvalRunCreateRequest request) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);
        PromptVersion promptVersion = evalAccessService.requirePromptVersion(scope.prompt(), request.promptVersionId());
        var dataset = evalAccessService.requireDataset(scope.workspace().getId(), request.datasetId());

        long totalCases = evalTestCaseRepository.countByDatasetIdAndEnabledTrue(dataset.getId());
        if (totalCases <= 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "활성화된 testCase가 없습니다.");
        }

        if (request.mode() == EvalMode.COMPARE_ACTIVE) {
            // Validate baseline exists and is different from candidate.
            resolveBaselineVersionForEstimate(scope.prompt(), promptVersion, request.mode());
        }

        EvalRun run = enqueueRun(
                scope.prompt(),
                promptVersion,
                dataset,
                scope.workspace().getId(),
                request.mode(),
                EvalTriggerType.MANUAL,
                request.rubricTemplateCode(),
                request.rubricOverrides(),
                Math.toIntExact(totalCases),
                scope.user().getId()
        );
        return EvalRunResponse.from(run);
    }

    @Transactional(readOnly = true)
    public EvalRunEstimateResponse estimateRun(
            Long workspaceId,
            Long promptId,
            Long userId,
            EvalRunEstimateRequest request
    ) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);
        PromptVersion candidateVersion = evalAccessService.requirePromptVersion(scope.prompt(), request.promptVersionId());
        var dataset = evalAccessService.requireDataset(scope.workspace().getId(), request.datasetId());
        var testCases = evalTestCaseRepository.findByDatasetIdAndEnabledTrueOrderByCaseOrderAsc(dataset.getId());
        if (testCases.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "활성화된 testCase가 없습니다.");
        }

        PromptVersion baselineVersion = resolveBaselineVersionForEstimate(scope.prompt(), candidateVersion, request.mode());

        int caseCount = testCases.size();
        int judgeAttemptsMin = 1;
        int judgeAttemptsMax = evalProperties.getJudge().isRejudgeOnFail()
                ? Math.max(1, evalProperties.getJudge().getMaxAttempts())
                : 1;

        long generationCallsPerCase = request.mode() == EvalMode.COMPARE_ACTIVE ? 2L : 1L;
        long judgeCallsPerCaseMin = request.mode() == EvalMode.COMPARE_ACTIVE ? 2L : 1L;
        long judgeCallsPerCaseMax = judgeCallsPerCaseMin * judgeAttemptsMax;
        long runOverallReviewCalls = 1L;

        long estimatedCallsMin = caseCount * (generationCallsPerCase + judgeCallsPerCaseMin) + runOverallReviewCalls;
        long estimatedCallsMax = caseCount * (generationCallsPerCase + judgeCallsPerCaseMax) + runOverallReviewCalls;

        int candidateMaxOutputTokens = resolveEstimateMaxOutputTokens(candidateVersion);
        int baselineMaxOutputTokens = baselineVersion != null ? resolveEstimateMaxOutputTokens(baselineVersion) : 0;
        int judgeMaxOutputTokens = 256;

        long generationInputTokens = testCases.stream()
                .mapToLong(testCase -> estimateTokens(buildFinalPrompt(candidateVersion, testCase)))
                .sum();

        long baselineInputTokens = 0L;
        if (baselineVersion != null) {
            baselineInputTokens = testCases.stream()
                    .mapToLong(testCase -> estimateTokens(buildFinalPrompt(baselineVersion, testCase)))
                    .sum();
        }

        long judgeInputTokensBase = testCases.stream()
                .mapToLong(testCase -> estimateJudgeInputTokens(testCase))
                .sum();
        long overallReviewInputTokens = estimateOverallReviewInputTokens(caseCount, request.mode());

        long candidateOutputMin = caseCount * Math.max(48, candidateMaxOutputTokens / 4L);
        long candidateOutputMax = caseCount * candidateMaxOutputTokens;
        long baselineOutputMin = baselineVersion != null ? caseCount * Math.max(48, baselineMaxOutputTokens / 4L) : 0L;
        long baselineOutputMax = baselineVersion != null ? caseCount * baselineMaxOutputTokens : 0L;
        long judgeOutputMin = caseCount * judgeCallsPerCaseMin * 120L;
        long judgeOutputMax = caseCount * judgeCallsPerCaseMax * judgeMaxOutputTokens;
        long overallReviewOutputMin = 160L;
        long overallReviewOutputMax = 320L;

        long estimatedTokensMin = generationInputTokens + baselineInputTokens + (judgeInputTokensBase * judgeCallsPerCaseMin)
                + candidateOutputMin + baselineOutputMin + judgeOutputMin
                + overallReviewInputTokens + overallReviewOutputMin;
        long estimatedTokensMax = generationInputTokens + baselineInputTokens + (judgeInputTokensBase * judgeCallsPerCaseMax)
                + candidateOutputMax + baselineOutputMax + judgeOutputMax
                + overallReviewInputTokens + overallReviewOutputMax;

        BigDecimal estimatedCostMin = estimateCost(
                candidateVersion.getModel(),
                generationInputTokens,
                candidateOutputMin
        )
                .add(estimateCost(
                        evalProperties.getJudge().getModel(),
                        judgeInputTokensBase * judgeCallsPerCaseMin,
                        judgeOutputMin
                ))
                .add(estimateCost(
                        evalProperties.getJudge().getModel(),
                        overallReviewInputTokens,
                        overallReviewOutputMin
                ));

        BigDecimal estimatedCostMax = estimateCost(
                candidateVersion.getModel(),
                generationInputTokens,
                candidateOutputMax
        )
                .add(estimateCost(
                        evalProperties.getJudge().getModel(),
                        judgeInputTokensBase * judgeCallsPerCaseMax,
                        judgeOutputMax
                ))
                .add(estimateCost(
                        evalProperties.getJudge().getModel(),
                        overallReviewInputTokens,
                        overallReviewOutputMax
                ));

        if (baselineVersion != null) {
            estimatedCostMin = estimatedCostMin.add(estimateCost(baselineVersion.getModel(), baselineInputTokens, baselineOutputMin));
            estimatedCostMax = estimatedCostMax.add(estimateCost(baselineVersion.getModel(), baselineInputTokens, baselineOutputMax));
        }

        double estimatedDurationSecMin = round2((estimatedCallsMin * 1.5d));
        double estimatedDurationSecMax = round2((estimatedCallsMax * 2.8d));
        boolean pricingKnown = ModelPricing.isKnownModel(candidateVersion.getModel())
                && ModelPricing.isKnownModel(evalProperties.getJudge().getModel())
                && (baselineVersion == null || ModelPricing.isKnownModel(baselineVersion.getModel()));
        String estimatedCostTier = resolveEstimatedCostTier(estimatedCostMin, estimatedCostMax, pricingKnown);

        Map<String, Object> assumptions = new LinkedHashMap<>();
        assumptions.put("candidateModel", candidateVersion.getModel());
        assumptions.put("baselineModel", baselineVersion != null ? baselineVersion.getModel() : null);
        assumptions.put("judgeModel", evalProperties.getJudge().getModel());
        assumptions.put("pricingKnown", pricingKnown);
        assumptions.put("judgeAttemptsMin", judgeAttemptsMin);
        assumptions.put("judgeAttemptsMax", judgeAttemptsMax);
        assumptions.put("runOverallReviewCalls", runOverallReviewCalls);
        assumptions.put("candidateMaxOutputTokens", candidateMaxOutputTokens);
        assumptions.put("baselineMaxOutputTokens", baselineMaxOutputTokens);
        assumptions.put("judgeMaxOutputTokens", judgeMaxOutputTokens);
        assumptions.put("overallReviewInputTokens", overallReviewInputTokens);
        assumptions.put("overallReviewOutputTokensMin", overallReviewOutputMin);
        assumptions.put("overallReviewOutputTokensMax", overallReviewOutputMax);
        assumptions.put("tokenEstimator", "chars/2 heuristic");
        assumptions.put("durationEstimator", "per-call fixed-range heuristic");

        return new EvalRunEstimateResponse(
                caseCount,
                estimatedCallsMin,
                estimatedCallsMax,
                estimatedTokensMin,
                estimatedTokensMax,
                estimatedCostMin.setScale(6, RoundingMode.HALF_UP),
                estimatedCostMax.setScale(6, RoundingMode.HALF_UP),
                estimatedCostTier,
                estimatedDurationSecMin,
                estimatedDurationSecMax,
                "예상치이며 실제 실행과 차이가 있을 수 있습니다.",
                assumptions
        );
    }

    @Transactional(readOnly = true)
    public List<EvalRunResponse> listRuns(Long workspaceId, Long promptId, Long userId) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);
        return evalRunRepository.findByPromptIdOrderByCreatedAtDesc(scope.prompt().getId())
                .stream()
                .map(EvalRunResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public EvalRunResponse getRun(Long workspaceId, Long promptId, Long runId, Long userId) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);
        EvalRun run = evalAccessService.requireRun(scope.prompt(), runId);
        return EvalRunResponse.from(run);
    }

    @Transactional
    public EvalCancelResponse cancelRun(Long workspaceId, Long promptId, Long runId, Long userId) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);
        EvalRun run = evalAccessService.requireRun(scope.prompt(), runId);
        run.markCancelled();
        return new EvalCancelResponse(run.getId(), run.status().name());
    }

    @Transactional(readOnly = true)
    public EvalCaseResultListResponse getRunCases(
            Long workspaceId,
            Long promptId,
            Long runId,
            Long userId,
            int page,
            int size
    ) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);
        EvalRun run = evalAccessService.requireRun(scope.prompt(), runId);

        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        PageRequest pageRequest = PageRequest.of(safePage, safeSize);
        Page<EvalCaseResultResponse> responsePage = evalCaseResultRepository
                .findByEvalRunIdOrderByIdAsc(run.getId(), pageRequest)
                .map(EvalCaseResultResponse::from);

        return EvalCaseResultListResponse.from(responsePage);
    }

    @Transactional(readOnly = true)
    public EvalCaseResultResponse getRunCase(
            Long workspaceId,
            Long promptId,
            Long runId,
            Long caseResultId,
            Long userId
    ) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);
        EvalRun run = evalAccessService.requireRun(scope.prompt(), runId);

        var caseResult = evalCaseResultRepository.findByIdAndEvalRunId(caseResultId, run.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        return EvalCaseResultResponse.from(caseResult);
    }

    @Transactional
    public void enqueueAutoRunIfEnabled(Long promptId, Long promptVersionId, Long actorUserId) {
        Prompt prompt = promptRepository.findByIdAndStatus(promptId, PromptStatus.ACTIVE)
                .orElse(null);
        if (prompt == null) {
            return;
        }

        PromptVersion promptVersion = promptVersionRepository.findById(promptVersionId)
                .filter(version -> version.getPrompt().getId().equals(promptId))
                .orElse(null);
        if (promptVersion == null) {
            return;
        }

        PromptEvalDefault defaults = promptEvalDefaultRepository.findByPromptId(promptId).orElse(null);
        if (defaults == null || !defaults.isAutoEvalEnabled() || defaults.getDataset() == null) {
            return;
        }

        var dataset = defaults.getDataset();
        if (!dataset.getWorkspaceId().equals(prompt.getWorkspace().getId())) {
            return;
        }

        long totalCases = evalTestCaseRepository.countByDatasetIdAndEnabledTrue(dataset.getId());
        if (totalCases <= 0) {
            log.info("Skip auto eval run. no enabled test cases. promptId={}, datasetId={}", promptId, dataset.getId());
            return;
        }

        if (defaults.defaultMode() == EvalMode.COMPARE_ACTIVE) {
            try {
                resolveBaselineVersionForEstimate(prompt, promptVersion, defaults.defaultMode());
            } catch (BusinessException e) {
                log.info("Skip auto eval compare run. promptId={}, reason={}", promptId, e.getMessage());
                return;
            }
        }

        Long createdBy = actorUserId != null ? actorUserId : promptVersion.getCreatedBy().getId();
        enqueueRun(
                prompt,
                promptVersion,
                dataset,
                prompt.getWorkspace().getId(),
                defaults.defaultMode(),
                EvalTriggerType.AUTO_VERSION_CREATE,
                defaults.rubricTemplateCode(),
                defaults.getRubricOverridesJson(),
                Math.toIntExact(totalCases),
                createdBy
        );
    }

    private EvalRun enqueueRun(
            Prompt prompt,
            PromptVersion promptVersion,
            com.llm_ops.demo.eval.domain.EvalDataset dataset,
            Long workspaceId,
            EvalMode mode,
            EvalTriggerType triggerType,
            com.llm_ops.demo.eval.domain.RubricTemplateCode rubricTemplateCode,
            Map<String, Object> rubricOverrides,
            int totalCases,
            Long createdBy
    ) {
        EvalRun run = EvalRun.queue(
                prompt,
                promptVersion,
                dataset,
                workspaceId,
                mode,
                triggerType,
                rubricTemplateCode,
                rubricOverrides,
                promptVersion.getProvider().name(),
                promptVersion.getModel(),
                evalProperties.getJudge().getProvider().name(),
                evalProperties.getJudge().getModel(),
                totalCases,
                createdBy
        );

        EvalRun savedRun = evalRunRepository.save(run);
        List<EvalCaseResult> caseResults = evalTestCaseRepository.findByDatasetIdAndEnabledTrueOrderByCaseOrderAsc(dataset.getId())
                .stream()
                .map(testCase -> EvalCaseResult.queue(savedRun, testCase))
                .toList();
        evalCaseResultRepository.saveAll(caseResults);

        return savedRun;
    }

    @Transactional
    public List<EvalRun> pickQueuedRuns(int batchSize) {
        int safeBatchSize = Math.max(batchSize, 1);
        List<EvalRun> queuedRuns = evalRunRepository.findQueuedRunsForUpdate(
                EvalRunStatus.QUEUED.name(),
                PageRequest.of(0, safeBatchSize)
        );

        if (queuedRuns.isEmpty()) {
            return queuedRuns;
        }

        queuedRuns.forEach(EvalRun::markRunning);
        return evalRunRepository.saveAll(queuedRuns);
    }

    private PromptVersion resolveBaselineVersionForEstimate(Prompt prompt, PromptVersion candidateVersion, EvalMode mode) {
        if (mode != EvalMode.COMPARE_ACTIVE) {
            return null;
        }

        var release = promptReleaseRepository.findWithActiveVersionByPromptId(prompt.getId()).orElse(null);
        if (release == null || release.getActiveVersion() == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "현재 배포(Active) 버전이 없어 비교 모드를 실행할 수 없습니다.");
        }

        PromptVersion activeVersion = release.getActiveVersion();
        if (Objects.equals(activeVersion.getId(), candidateVersion.getId())) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "비교 대상이 동일합니다. 현재 배포 버전과 다른 후보 버전을 선택하세요.");
        }
        return activeVersion;
    }

    private String buildFinalPrompt(PromptVersion version, com.llm_ops.demo.eval.domain.EvalTestCase testCase) {
        Map<String, String> variables = new LinkedHashMap<>();
        variables.put("question", testCase.getInputText());

        if (testCase.getContextJson() != null) {
            for (Map.Entry<String, Object> entry : testCase.getContextJson().entrySet()) {
                if (entry.getKey() == null || entry.getValue() == null) {
                    continue;
                }
                variables.put(entry.getKey(), String.valueOf(entry.getValue()));
            }
            if (!variables.containsKey("context")) {
                variables.put("context", String.valueOf(testCase.getContextJson()));
            }
        }

        String userTemplate = version.getUserTemplate();
        if (userTemplate == null || userTemplate.isBlank()) {
            userTemplate = "{{question}}";
        }
        String renderedUser = renderTemplate(userTemplate, variables);

        String systemTemplate = version.getSystemPrompt();
        String renderedSystem = (systemTemplate == null || systemTemplate.isBlank())
                ? null
                : renderTemplate(systemTemplate, variables);

        if (renderedSystem == null || renderedSystem.isBlank()) {
            return renderedUser;
        }
        return renderedSystem + "\n\n" + renderedUser;
    }

    private String renderTemplate(String template, Map<String, String> variables) {
        String rendered = template;
        for (Map.Entry<String, String> entry : variables.entrySet()) {
            String key = entry.getKey();
            String value = entry.getValue() == null ? "" : entry.getValue();
            rendered = rendered.replace("{{" + key + "}}", value);
            rendered = rendered.replace("{" + key + "}", value);
        }
        return rendered;
    }

    private int resolveEstimateMaxOutputTokens(PromptVersion version) {
        Integer configured = readMaxOutputTokens(version.getModelConfig());
        if (configured != null && configured > 0) {
            return configured;
        }
        return switch (version.getProvider()) {
            case OPENAI -> 512;
            case ANTHROPIC -> 600;
            case GEMINI -> 700;
        };
    }

    private Integer readMaxOutputTokens(Map<String, Object> modelConfig) {
        if (modelConfig == null) {
            return null;
        }
        Object value = modelConfig.get("maxOutputTokens");
        if (value == null) {
            value = modelConfig.get("maxTokens");
        }
        if (value == null) {
            value = modelConfig.get("max_tokens");
        }
        if (value == null) {
            return null;
        }
        try {
            int parsed = Integer.parseInt(String.valueOf(value));
            return parsed > 0 ? parsed : null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private long estimateJudgeInputTokens(com.llm_ops.demo.eval.domain.EvalTestCase testCase) {
        int baseChars = safeLength(testCase.getInputText())
                + safeLength(String.valueOf(testCase.getContextJson()))
                + safeLength(String.valueOf(testCase.getExpectedJson()))
                + safeLength(String.valueOf(testCase.getConstraintsJson()));
        return Math.max(180L, estimateTokens(baseChars + 300));
    }

    private long estimateOverallReviewInputTokens(int caseCount, EvalMode mode) {
        int normalizedCaseCount = Math.max(caseCount, 1);
        int modeFactor = mode == EvalMode.COMPARE_ACTIVE ? 90 : 60;
        int chars = 300 + (normalizedCaseCount * modeFactor);
        return Math.max(220L, estimateTokens(chars));
    }

    private long estimateTokens(String text) {
        return estimateTokens(safeLength(text));
    }

    private long estimateTokens(int chars) {
        if (chars <= 0) {
            return 0L;
        }
        return Math.max(1L, Math.round(chars / 2.0d));
    }

    private static int safeLength(String text) {
        return text == null ? 0 : text.length();
    }

    private BigDecimal estimateCost(String model, long inputTokens, long outputTokens) {
        if (model == null || model.isBlank()) {
            return BigDecimal.ZERO;
        }
        return ModelPricing.calculateCost(model, safeToInt(inputTokens), safeToInt(outputTokens));
    }

    private int safeToInt(long value) {
        if (value <= 0) {
            return 0;
        }
        return value > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) value;
    }

    private double round2(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    private String resolveEstimatedCostTier(BigDecimal minCost, BigDecimal maxCost, boolean pricingKnown) {
        if (!pricingKnown) {
            return "UNKNOWN";
        }
        BigDecimal max = maxCost != null ? maxCost : (minCost != null ? minCost : BigDecimal.ZERO);
        if (max.compareTo(new BigDecimal("0.20")) >= 0) {
            return "HIGH";
        }
        if (max.compareTo(new BigDecimal("0.05")) >= 0) {
            return "MEDIUM";
        }
        return "LOW";
    }
}
