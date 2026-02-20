package com.llm_ops.demo.eval.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.llm_ops.demo.eval.domain.EvalCaseResult;
import com.llm_ops.demo.eval.domain.EvalCaseStatus;
import com.llm_ops.demo.eval.domain.EvalMode;
import com.llm_ops.demo.eval.domain.EvalReleaseCriteria;
import com.llm_ops.demo.eval.domain.EvalRun;
import com.llm_ops.demo.eval.domain.EvalRunStatus;
import com.llm_ops.demo.eval.domain.EvalTestCase;
import com.llm_ops.demo.eval.domain.RubricTemplateCode;
import com.llm_ops.demo.eval.repository.EvalCaseResultRepository;
import com.llm_ops.demo.eval.repository.EvalRunRepository;
import com.llm_ops.demo.eval.rubric.EvalRubricTemplateRegistry;
import com.llm_ops.demo.eval.rubric.ResolvedRubricConfig;
import com.llm_ops.demo.eval.rule.EvalRuleCheckerService;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import com.llm_ops.demo.prompt.repository.PromptReleaseRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class EvalExecutionService {

    private static final Logger log = LoggerFactory.getLogger(EvalExecutionService.class);

    private final EvalRunRepository evalRunRepository;
    private final EvalCaseResultRepository evalCaseResultRepository;
    private final PromptReleaseRepository promptReleaseRepository;
    private final EvalModelRunnerService evalModelRunnerService;
    private final EvalRuleCheckerService evalRuleCheckerService;
    private final EvalRubricTemplateRegistry evalRubricTemplateRegistry;
    private final EvalJudgeService evalJudgeService;
    private final EvalReleaseCriteriaService evalReleaseCriteriaService;
    private final EvalReleaseDecisionCalculator evalReleaseDecisionCalculator;
    private final ObjectMapper objectMapper;

    public EvalExecutionService(
            EvalRunRepository evalRunRepository,
            EvalCaseResultRepository evalCaseResultRepository,
            PromptReleaseRepository promptReleaseRepository,
            EvalModelRunnerService evalModelRunnerService,
            EvalRuleCheckerService evalRuleCheckerService,
            EvalRubricTemplateRegistry evalRubricTemplateRegistry,
            EvalJudgeService evalJudgeService,
            EvalReleaseCriteriaService evalReleaseCriteriaService,
            EvalReleaseDecisionCalculator evalReleaseDecisionCalculator,
            ObjectMapper objectMapper
    ) {
        this.evalRunRepository = evalRunRepository;
        this.evalCaseResultRepository = evalCaseResultRepository;
        this.promptReleaseRepository = promptReleaseRepository;
        this.evalModelRunnerService = evalModelRunnerService;
        this.evalRuleCheckerService = evalRuleCheckerService;
        this.evalRubricTemplateRegistry = evalRubricTemplateRegistry;
        this.evalJudgeService = evalJudgeService;
        this.evalReleaseCriteriaService = evalReleaseCriteriaService;
        this.evalReleaseDecisionCalculator = evalReleaseDecisionCalculator;
        this.objectMapper = objectMapper;
    }

    public void processRun(Long runId) {
        EvalRun run = evalRunRepository.findById(runId).orElse(null);
        if (run == null) {
            return;
        }
        if (run.status() != EvalRunStatus.QUEUED && run.status() != EvalRunStatus.RUNNING) {
            return;
        }
        if (run.status() == EvalRunStatus.QUEUED) {
            run.markRunning();
            evalRunRepository.save(run);
        }

        CostAccumulator costAccumulator = new CostAccumulator();

        try {
            ResolvedRubricConfig rubric = evalRubricTemplateRegistry.resolve(
                    run.rubricTemplateCode(),
                    run.getRubricOverridesJson()
            );

            PromptVersion baselineVersion = resolveBaselineVersion(run);
            boolean compareBaselineAvailable = run.mode() != EvalMode.COMPARE_ACTIVE || baselineVersion != null;
            List<EvalCaseResult> caseResults = evalCaseResultRepository.findByEvalRunIdOrderByIdAsc(run.getId());

            for (EvalCaseResult caseResult : caseResults) {
                if (isRunCancelled(run.getId())) {
                    log.info("Eval run cancelled while processing. runId={}", run.getId());
                    return;
                }
                if (caseResult.status() != EvalCaseStatus.QUEUED) {
                    continue;
                }
                processCase(run, caseResult, rubric, baselineVersion, costAccumulator);
            }

            finishRun(run.getId(), costAccumulator, compareBaselineAvailable);
        } catch (Exception e) {
            log.error("Eval run failed. runId={}", runId, e);
            failRun(runId, costAccumulator, e.getMessage());
        }
    }

    private void processCase(
            EvalRun run,
            EvalCaseResult caseResult,
            ResolvedRubricConfig rubric,
            PromptVersion baselineVersion,
            CostAccumulator costAccumulator
    ) {
        caseResult.markRunning();
        evalCaseResultRepository.save(caseResult);

        try {
            EvalTestCase testCase = caseResult.getTestCase();
            PromptVersion candidateVersion = run.getPromptVersion();

            Long organizationId = run.getPrompt().getWorkspace().getOrganization().getId();
            String candidatePrompt = buildFinalPrompt(candidateVersion, testCase);

            EvalModelRunnerService.ModelExecution candidateExecution = evalModelRunnerService.run(
                    organizationId,
                    candidateVersion.getProvider(),
                    candidateVersion.getModel(),
                    candidatePrompt,
                    readTemperature(candidateVersion.getModelConfig()),
                    resolveMaxOutputTokens(candidateVersion.getProvider(), candidateVersion.getModelConfig())
            );
            costAccumulator.add(candidateExecution.meta());
            RubricTemplateCode rubricTemplateCode = run.rubricTemplateCode();

            String baselineOutput = null;
            Map<String, Object> baselineMeta = null;
            Map<String, Object> baselineRuleChecks = null;
            EvalJudgeService.JudgeResult baselineJudgeResult = null;
            if (baselineVersion != null) {
                try {
                    String baselinePrompt = buildFinalPrompt(baselineVersion, testCase);
                    EvalModelRunnerService.ModelExecution baselineExecution = evalModelRunnerService.run(
                            organizationId,
                            baselineVersion.getProvider(),
                            baselineVersion.getModel(),
                            baselinePrompt,
                            readTemperature(baselineVersion.getModelConfig()),
                            resolveMaxOutputTokens(baselineVersion.getProvider(), baselineVersion.getModelConfig())
                    );
                    baselineOutput = baselineExecution.outputText();
                    baselineMeta = baselineExecution.meta();
                    costAccumulator.add(baselineMeta);

                    baselineRuleChecks = evalRuleCheckerService.check(
                            baselineExecution.outputText(),
                            testCase.getConstraintsJson(),
                            testCase.getExpectedJson(),
                            rubricTemplateCode
                    );
                    baselineJudgeResult = evalJudgeService.judge(
                            organizationId,
                            rubric,
                            testCase.getInputText(),
                            testCase.getContextJson(),
                            testCase.getExpectedJson(),
                            testCase.getConstraintsJson(),
                            baselineExecution.outputText(),
                            baselineRuleChecks,
                            null
                    );
                    Object baselineJudgeMeta = baselineJudgeResult.judgeOutput().get("judgeMeta");
                    if (baselineJudgeMeta instanceof Map<?, ?> judgeMetaMap) {
                        costAccumulator.add(castObjectMap(judgeMetaMap));
                    }
                } catch (Exception baselineException) {
                    baselineMeta = Map.of(
                            "error", "BASELINE_EXECUTION_FAILED",
                            "message", sanitizeMessage(baselineException.getMessage())
                    );
                }
            }

            Map<String, Object> ruleChecks = evalRuleCheckerService.check(
                    candidateExecution.outputText(),
                    testCase.getConstraintsJson(),
                    testCase.getExpectedJson(),
                    rubricTemplateCode
            );

            EvalJudgeService.JudgeResult judgeResult = evalJudgeService.judge(
                    organizationId,
                    rubric,
                    testCase.getInputText(),
                    testCase.getContextJson(),
                    testCase.getExpectedJson(),
                    testCase.getConstraintsJson(),
                    candidateExecution.outputText(),
                    ruleChecks,
                    baselineOutput
            );

            Map<String, Object> judgeOutput = new LinkedHashMap<>(judgeResult.judgeOutput());
            Object judgeMeta = judgeOutput.get("judgeMeta");
            if (judgeMeta instanceof Map<?, ?> judgeMetaMap) {
                costAccumulator.add(castObjectMap(judgeMetaMap));
            }

            Map<String, Object> storedRuleChecks = combineRuleChecks(ruleChecks, baselineRuleChecks);
            if (baselineJudgeResult != null) {
                judgeOutput.put("baseline", baselineJudgeResult.judgeOutput());
                judgeOutput.put("compare", buildCompareSummary(judgeResult, baselineJudgeResult));
            }

            caseResult.markOk(
                    candidateExecution.outputText(),
                    baselineOutput,
                    candidateExecution.meta(),
                    baselineMeta,
                    storedRuleChecks,
                    judgeOutput,
                    judgeResult.overallScore(),
                    judgeResult.pass()
            );
            evalCaseResultRepository.save(caseResult);

            EvalRun latestRun = evalRunRepository.findById(run.getId()).orElseThrow();
            latestRun.onCaseOk(judgeResult.pass());
            evalRunRepository.save(latestRun);
        } catch (Exception e) {
            caseResult.markError("EVAL_CASE_EXECUTION_ERROR", sanitizeMessage(e.getMessage()));
            evalCaseResultRepository.save(caseResult);

            EvalRun latestRun = evalRunRepository.findById(run.getId()).orElseThrow();
            latestRun.onCaseError();
            evalRunRepository.save(latestRun);
        }
    }

    private PromptVersion resolveBaselineVersion(EvalRun run) {
        if (run.mode() != EvalMode.COMPARE_ACTIVE) {
            return null;
        }

        var release = promptReleaseRepository.findWithActiveVersionByPromptId(run.getPrompt().getId()).orElse(null);
        if (release == null || release.getActiveVersion() == null) {
            return null;
        }

        PromptVersion activeVersion = release.getActiveVersion();
        if (Objects.equals(activeVersion.getId(), run.getPromptVersion().getId())) {
            return null;
        }

        return activeVersion;
    }

    private Map<String, Object> combineRuleChecks(
            Map<String, Object> candidateRuleChecks,
            Map<String, Object> baselineRuleChecks
    ) {
        Map<String, Object> candidate = candidateRuleChecks != null
                ? new LinkedHashMap<>(candidateRuleChecks)
                : new LinkedHashMap<>();
        if (baselineRuleChecks == null) {
            return candidate;
        }

        Map<String, Object> combined = new LinkedHashMap<>(candidate);
        combined.put("candidate", candidate);
        combined.put("baseline", new LinkedHashMap<>(baselineRuleChecks));
        return combined;
    }

    private Map<String, Object> buildCompareSummary(
            EvalJudgeService.JudgeResult candidateJudgeResult,
            EvalJudgeService.JudgeResult baselineJudgeResult
    ) {
        double candidateScore = candidateJudgeResult.overallScore();
        double baselineScore = baselineJudgeResult.overallScore();
        boolean candidatePass = candidateJudgeResult.pass();
        boolean baselinePass = baselineJudgeResult.pass();
        double scoreDelta = round(candidateScore - baselineScore);

        String winner;
        if (candidatePass && !baselinePass) {
            winner = "CANDIDATE";
        } else if (!candidatePass && baselinePass) {
            winner = "BASELINE";
        } else if (Math.abs(scoreDelta) < 0.01d) {
            winner = "TIE";
        } else {
            winner = scoreDelta > 0 ? "CANDIDATE" : "BASELINE";
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("candidateOverallScore", round(candidateScore));
        summary.put("baselineOverallScore", round(baselineScore));
        summary.put("candidatePass", candidatePass);
        summary.put("baselinePass", baselinePass);
        summary.put("scoreDelta", scoreDelta);
        summary.put("winner", winner);
        return summary;
    }

    private String buildFinalPrompt(PromptVersion version, EvalTestCase testCase) {
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
                variables.put("context", toJson(testCase.getContextJson()));
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

    private boolean isRunCancelled(Long runId) {
        return evalRunRepository.findById(runId)
                .map(run -> run.status() == EvalRunStatus.CANCELLED)
                .orElse(true);
    }

    private void finishRun(Long runId, CostAccumulator costAccumulator, boolean compareBaselineAvailable) {
        EvalRun run = evalRunRepository.findById(runId).orElse(null);
        if (run == null || run.status() == EvalRunStatus.CANCELLED) {
            return;
        }

        List<EvalCaseResult> allResults = evalCaseResultRepository.findByEvalRunIdOrderByIdAsc(runId);
        List<EvalCaseResult> okResults = allResults.stream()
                .filter(result -> result.status() == EvalCaseStatus.OK)
                .toList();

        double avgScore = okResults.stream()
                .map(EvalCaseResult::getOverallScore)
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .average()
                .orElse(0.0);

        double passRate = run.getProcessedCases() > 0
                ? (run.getPassedCases() * 100.0) / run.getProcessedCases()
                : 0.0;
        double errorRate = run.getProcessedCases() > 0
                ? (run.getErrorCases() * 100.0) / run.getProcessedCases()
                : 0.0;
        Double avgScoreDelta = run.mode() == EvalMode.COMPARE_ACTIVE
                ? computeAvgScoreDelta(okResults)
                : null;

        long compareAvailableOkCases = 0L;
        long compareMissingOkCases = 0L;
        boolean compareBaselineComplete = true;
        if (run.mode() == EvalMode.COMPARE_ACTIVE) {
            compareAvailableOkCases = okResults.stream()
                    .filter(result -> hasCompareSummary(result.getJudgeOutputJson()))
                    .count();
            compareMissingOkCases = Math.max(0L, okResults.size() - compareAvailableOkCases);
            // baseline 자체를 찾지 못했거나, OK 케이스 중 비교 누락이 있으면 비교 불완전으로 처리한다.
            compareBaselineComplete = compareBaselineAvailable && (okResults.isEmpty() || compareMissingOkCases == 0L);
        }

        EvalReleaseCriteria criteria = evalReleaseCriteriaService.resolveOrDefault(run.getWorkspaceId());
        EvalReleaseDecision releaseDecision = evalReleaseDecisionCalculator.calculate(
                run.mode(),
                criteria,
                passRate,
                avgScore,
                errorRate,
                avgScoreDelta,
                compareBaselineComplete
        );

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalCases", run.getTotalCases());
        summary.put("processedCases", run.getProcessedCases());
        summary.put("passedCases", run.getPassedCases());
        summary.put("failedCases", run.getFailedCases());
        summary.put("errorCases", run.getErrorCases());
        summary.put("passRate", round(passRate));
        summary.put("avgOverallScore", round(avgScore));
        summary.put("errorRate", round(errorRate));
        summary.put("releaseDecision", releaseDecision.releaseDecision());
        summary.put("riskLevel", releaseDecision.riskLevel());
        summary.put("decisionReasons", releaseDecision.reasons());
        summary.put("decisionBasis", releaseDecision.decisionBasis());
        summary.put("criteriaSnapshot", buildCriteriaSnapshot(criteria));
        if (avgScoreDelta != null) {
            summary.put("avgScoreDelta", round(avgScoreDelta));
        }
        if (run.mode() == EvalMode.COMPARE_ACTIVE) {
            summary.put("compareBaselineAvailable", compareBaselineAvailable);
            summary.put("compareBaselineComplete", compareBaselineComplete);
            summary.put("compareOkCases", compareAvailableOkCases);
            summary.put("compareMissingOkCases", compareMissingOkCases);
            if (!okResults.isEmpty()) {
                summary.put("compareCoverageRate", round((compareAvailableOkCases * 100.0) / okResults.size()));
            }
        }
        Map<String, Long> ruleFailCounts = collectRuleFailCounts(okResults);
        Map<String, Long> ruleWarningCounts = collectRuleWarningCounts(okResults);
        Map<String, Long> errorCodeCounts = collectErrorCodeCounts(allResults);
        Map<String, Long> labelCounts = collectLabelCounts(okResults);
        summary.put("ruleFailCounts", ruleFailCounts);
        summary.put("ruleWarningCounts", ruleWarningCounts);
        summary.put("errorCodeCounts", errorCodeCounts);
        summary.put("labelCounts", labelCounts);

        List<String> topIssues = buildTopIssues(
                releaseDecision,
                ruleFailCounts,
                ruleWarningCounts,
                errorCodeCounts,
                labelCounts
        );
        summary.put("topIssues", topIssues);
        summary.put("plainSummary", buildPlainSummary(releaseDecision, passRate, avgScore, avgScoreDelta, topIssues));

        run.finish(summary, costAccumulator.asMap());
        evalRunRepository.save(run);
    }

    private void failRun(Long runId, CostAccumulator costAccumulator, String reason) {
        EvalRun run = evalRunRepository.findById(runId).orElse(null);
        if (run == null || run.status() == EvalRunStatus.CANCELLED) {
            return;
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalCases", run.getTotalCases());
        summary.put("processedCases", run.getProcessedCases());
        summary.put("passedCases", run.getPassedCases());
        summary.put("failedCases", run.getFailedCases());
        summary.put("errorCases", run.getErrorCases());
        summary.put("failReason", sanitizeMessage(reason));

        run.fail(summary, costAccumulator.asMap());
        evalRunRepository.save(run);
    }

    private boolean hasCompareSummary(Map<String, Object> judgeOutput) {
        if (judgeOutput == null) {
            return false;
        }
        Object compare = judgeOutput.get("compare");
        return compare instanceof Map<?, ?>;
    }

    private Double computeAvgScoreDelta(List<EvalCaseResult> okResults) {
        List<Double> deltas = okResults.stream()
                .map(EvalCaseResult::getJudgeOutputJson)
                .map(this::extractCompareScoreDelta)
                .filter(Objects::nonNull)
                .toList();
        if (deltas.isEmpty()) {
            return null;
        }
        return deltas.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
    }

    private Double extractCompareScoreDelta(Map<String, Object> judgeOutput) {
        if (judgeOutput == null) {
            return null;
        }
        Object compare = judgeOutput.get("compare");
        if (!(compare instanceof Map<?, ?> compareMap)) {
            return null;
        }
        Object scoreDelta = compareMap.get("scoreDelta");
        if (scoreDelta == null) {
            return null;
        }
        try {
            return Double.parseDouble(String.valueOf(scoreDelta));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private Map<String, Object> buildCriteriaSnapshot(EvalReleaseCriteria criteria) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("minPassRate", criteria.getMinPassRate());
        snapshot.put("minAvgOverallScore", criteria.getMinAvgOverallScore());
        snapshot.put("maxErrorRate", criteria.getMaxErrorRate());
        snapshot.put("minImprovementNoticeDelta", criteria.getMinImprovementNoticeDelta());
        return snapshot;
    }

    private List<String> buildTopIssues(
            EvalReleaseDecision releaseDecision,
            Map<String, Long> ruleFailCounts,
            Map<String, Long> ruleWarningCounts,
            Map<String, Long> errorCodeCounts,
            Map<String, Long> labelCounts
    ) {
        LinkedHashSet<String> issues = new LinkedHashSet<>();
        for (String reason : releaseDecision.reasons()) {
            issues.add(mapDecisionReasonLabel(reason));
        }
        topKey(ruleFailCounts).ifPresent(rule -> issues.add("형식 검사 주요 실패: " + rule));
        topKey(ruleWarningCounts).ifPresent(rule -> issues.add("형식 검사 주요 경고: " + rule));
        topKey(errorCodeCounts).ifPresent(code -> issues.add("실행 오류 코드: " + code));
        topKey(labelCounts).ifPresent(label -> issues.add("AI 심사 주요 이슈: " + label));
        return issues.stream().limit(5).toList();
    }

    private String buildPlainSummary(
            EvalReleaseDecision releaseDecision,
            double passRate,
            double avgScore,
            Double avgScoreDelta,
            List<String> topIssues
    ) {
        List<String> parts = new ArrayList<>();
        parts.add("판정: " + ("HOLD".equals(releaseDecision.releaseDecision()) ? "배포 보류" : "배포 가능"));
        parts.add("PassRate " + round(passRate) + "%");
        parts.add("평균점수 " + round(avgScore));
        if (avgScoreDelta != null) {
            parts.add("비교Δ " + round(avgScoreDelta));
        }
        if (!topIssues.isEmpty()) {
            parts.add("주요 이슈: " + topIssues.get(0));
        }
        return String.join(" / ", parts);
    }

    private String mapDecisionReasonLabel(String reason) {
        return switch (reason) {
            case "PASS_RATE_BELOW_THRESHOLD" -> "PassRate 기준 미달";
            case "AVG_SCORE_BELOW_THRESHOLD" -> "평균 점수 기준 미달";
            case "ERROR_RATE_ABOVE_THRESHOLD" -> "오류율 기준 초과";
            case "COMPARE_REGRESSION_DETECTED" -> "배포 버전 대비 회귀";
            case "COMPARE_IMPROVEMENT_MINOR" -> "개선폭이 작음";
            case "COMPARE_BASELINE_INCOMPLETE" -> "운영 비교 데이터 불완전";
            default -> reason;
        };
    }

    private java.util.Optional<String> topKey(Map<String, Long> counts) {
        if (counts == null || counts.isEmpty()) {
            return java.util.Optional.empty();
        }
        return counts.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey);
    }

    private Map<String, Long> collectRuleFailCounts(List<EvalCaseResult> okResults) {
        return collectRuleCounts(okResults, "failedChecks");
    }

    private Map<String, Long> collectRuleWarningCounts(List<EvalCaseResult> okResults) {
        return collectRuleCounts(okResults, "warningChecks");
    }

    private Map<String, Long> collectRuleCounts(List<EvalCaseResult> okResults, String keyName) {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (EvalCaseResult result : okResults) {
            Map<String, Object> ruleChecks = result.getRuleChecksJson();
            Map<String, Object> candidate = extractCandidateRuleChecks(ruleChecks);
            Object checkValues = candidate.get(keyName);
            if (checkValues instanceof List<?> checks) {
                for (Object check : checks) {
                    if (check == null) {
                        continue;
                    }
                    String key = String.valueOf(check);
                    counts.put(key, counts.getOrDefault(key, 0L) + 1L);
                }
            }
        }
        return sortCountsDesc(counts);
    }

    private Map<String, Long> collectErrorCodeCounts(List<EvalCaseResult> allResults) {
        Map<String, Long> counts = allResults.stream()
                .map(EvalCaseResult::getErrorCode)
                .filter(code -> code != null && !code.isBlank())
                .collect(Collectors.groupingBy(code -> code, LinkedHashMap::new, Collectors.counting()));
        return sortCountsDesc(counts);
    }

    private Map<String, Long> collectLabelCounts(List<EvalCaseResult> okResults) {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (EvalCaseResult result : okResults) {
            Map<String, Object> judgeOutput = result.getJudgeOutputJson();
            if (judgeOutput == null) {
                continue;
            }
            Object labels = judgeOutput.get("labels");
            if (!(labels instanceof List<?> labelList)) {
                continue;
            }
            for (Object label : labelList) {
                if (label == null) {
                    continue;
                }
                String key = String.valueOf(label);
                counts.put(key, counts.getOrDefault(key, 0L) + 1L);
            }
        }
        return sortCountsDesc(counts);
    }

    private Map<String, Object> extractCandidateRuleChecks(Map<String, Object> ruleChecks) {
        if (ruleChecks == null) {
            return Map.of();
        }
        Object candidate = ruleChecks.get("candidate");
        if (candidate instanceof Map<?, ?> candidateMap) {
            return castObjectMap(candidateMap);
        }
        return ruleChecks;
    }

    private Map<String, Long> sortCountsDesc(Map<String, Long> input) {
        return input.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        Map.Entry::getValue,
                        (left, right) -> left,
                        LinkedHashMap::new
                ));
    }

    private String sanitizeMessage(String value) {
        if (value == null || value.isBlank()) {
            return "unknown";
        }
        if (value.length() > 400) {
            return value.substring(0, 400);
        }
        return value;
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return String.valueOf(value);
        }
    }

    private static Double readTemperature(Map<String, Object> modelConfig) {
        if (modelConfig == null) {
            return null;
        }
        Object value = modelConfig.get("temperature");
        if (value == null) {
            return null;
        }
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static Integer readMaxOutputTokens(Map<String, Object> modelConfig) {
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

    private static Integer resolveMaxOutputTokens(
            com.llm_ops.demo.keys.domain.ProviderType provider,
            Map<String, Object> modelConfig
    ) {
        if (provider == com.llm_ops.demo.keys.domain.ProviderType.OPENAI) {
            return null;
        }
        return readMaxOutputTokens(modelConfig);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> castObjectMap(Map<?, ?> map) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            if (entry.getKey() != null) {
                result.put(String.valueOf(entry.getKey()), entry.getValue());
            }
        }
        return result;
    }

    private static double round(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    private static final class CostAccumulator {
        private long totalTokens = 0L;
        private BigDecimal totalCostUsd = BigDecimal.ZERO;

        void add(Map<String, Object> meta) {
            if (meta == null) {
                return;
            }
            Object tokensValue = meta.get("totalTokens");
            if (tokensValue != null) {
                try {
                    totalTokens += Long.parseLong(String.valueOf(tokensValue));
                } catch (NumberFormatException ignored) {
                }
            }

            Object costValue = meta.get("estimatedCostUsd");
            if (costValue != null) {
                try {
                    totalCostUsd = totalCostUsd.add(new BigDecimal(String.valueOf(costValue)));
                } catch (NumberFormatException ignored) {
                }
            }
        }

        Map<String, Object> asMap() {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("totalTokens", totalTokens);
            map.put("totalCostUsd", totalCostUsd.setScale(6, RoundingMode.HALF_UP));
            return map;
        }
    }
}
