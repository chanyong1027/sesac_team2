package com.llm_ops.demo.eval.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.llm_ops.demo.eval.domain.EvalCaseResult;
import com.llm_ops.demo.eval.domain.EvalCaseStatus;
import com.llm_ops.demo.eval.domain.EvalRun;
import com.llm_ops.demo.eval.domain.EvalRunStatus;
import com.llm_ops.demo.eval.domain.EvalTestCase;
import com.llm_ops.demo.eval.domain.RubricTemplateCode;
import com.llm_ops.demo.eval.repository.EvalCaseResultRepository;
import com.llm_ops.demo.eval.repository.EvalRunRepository;
import com.llm_ops.demo.eval.rubric.ResolvedRubricConfig;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import com.llm_ops.demo.prompt.repository.PromptVersionRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EvalCaseExecutionService {

    private final EvalCaseResultRepository evalCaseResultRepository;
    private final EvalRunRepository evalRunRepository;
    private final PromptVersionRepository promptVersionRepository;
    private final EvalModelRunnerService evalModelRunnerService;
    private final com.llm_ops.demo.eval.rule.EvalRuleCheckerService evalRuleCheckerService;
    private final EvalJudgeService evalJudgeService;
    private final ObjectMapper objectMapper;

    public EvalCaseExecutionService(
            EvalCaseResultRepository evalCaseResultRepository,
            EvalRunRepository evalRunRepository,
            PromptVersionRepository promptVersionRepository,
            EvalModelRunnerService evalModelRunnerService,
            com.llm_ops.demo.eval.rule.EvalRuleCheckerService evalRuleCheckerService,
            EvalJudgeService evalJudgeService,
            ObjectMapper objectMapper
    ) {
        this.evalCaseResultRepository = evalCaseResultRepository;
        this.evalRunRepository = evalRunRepository;
        this.promptVersionRepository = promptVersionRepository;
        this.evalModelRunnerService = evalModelRunnerService;
        this.evalRuleCheckerService = evalRuleCheckerService;
        this.evalJudgeService = evalJudgeService;
        this.objectMapper = objectMapper;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void executeCase(
            Long runId,
            Long caseResultId,
            ResolvedRubricConfig rubric,
            Long baselineVersionId,
            Duration runLeaseDuration
    ) {
        EvalCaseResult caseResult = evalCaseResultRepository.findById(caseResultId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "평가 케이스를 찾을 수 없습니다."));
        EvalRun run = caseResult.getEvalRun();

        if (!run.getId().equals(runId)) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "runId와 caseResultId가 일치하지 않습니다.");
        }

        if (run.status() == EvalRunStatus.CANCEL_REQUESTED || run.status() == EvalRunStatus.CANCELLED) {
            if (caseResult.status() == EvalCaseStatus.QUEUED) {
                caseResult.markSkipped("RUN_CANCELLED", "실행 중 취소되어 시작되지 않은 케이스입니다.");
                evalCaseResultRepository.save(caseResult);
            }
            return;
        }
        if (caseResult.status() != EvalCaseStatus.QUEUED) {
            return;
        }

        caseResult.markRunning();
        evalCaseResultRepository.save(caseResult);

        try {
            EvalTestCase testCase = caseResult.getTestCase();
            PromptVersion candidateVersion = run.getPromptVersion();
            PromptVersion baselineVersion = baselineVersionId != null
                    ? promptVersionRepository.findById(baselineVersionId).orElse(null)
                    : null;

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
            incrementRunProgress(runId, judgeResult.pass() ? 1 : 0, judgeResult.pass() ? 0 : 1, 0, runLeaseDuration);
        } catch (Exception exception) {
            caseResult.markError("EVAL_CASE_EXECUTION_ERROR", sanitizeMessage(exception.getMessage()));
            evalCaseResultRepository.save(caseResult);
            incrementRunProgress(runId, 0, 0, 1, runLeaseDuration);
        }
    }

    private void incrementRunProgress(
            Long runId,
            int passedIncrement,
            int failedIncrement,
            int errorIncrement,
            Duration runLeaseDuration
    ) {
        LocalDateTime heartbeatAt = LocalDateTime.now();
        LocalDateTime leaseExpiresAt = runLeaseDuration != null ? heartbeatAt.plus(runLeaseDuration) : null;
        evalRunRepository.incrementProgress(
                runId,
                passedIncrement,
                failedIncrement,
                errorIncrement,
                heartbeatAt,
                leaseExpiresAt,
                java.util.List.of(EvalRunStatus.RUNNING.name(), EvalRunStatus.CANCEL_REQUESTED.name())
        );
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
        } catch (Exception exception) {
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
            value = modelConfig.get("max_output_tokens");
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

    private static double round(double value) {
        return java.math.BigDecimal.valueOf(value)
                .setScale(2, java.math.RoundingMode.HALF_UP)
                .doubleValue();
    }
}
