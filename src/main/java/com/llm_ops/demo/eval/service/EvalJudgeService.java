package com.llm_ops.demo.eval.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.llm_ops.demo.eval.config.EvalProperties;
import com.llm_ops.demo.eval.rubric.ResolvedRubricConfig;
import com.llm_ops.demo.keys.domain.ProviderType;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class EvalJudgeService {

    private static final Logger log = LoggerFactory.getLogger(EvalJudgeService.class);

    private final EvalProperties evalProperties;
    private final EvalModelRunnerService evalModelRunnerService;
    private final ObjectMapper objectMapper;

    public EvalJudgeService(
            EvalProperties evalProperties,
            EvalModelRunnerService evalModelRunnerService,
            ObjectMapper objectMapper
    ) {
        this.evalProperties = evalProperties;
        this.evalModelRunnerService = evalModelRunnerService;
        this.objectMapper = objectMapper;
    }

    public JudgeResult judge(
            Long organizationId,
            ResolvedRubricConfig rubric,
            String input,
            Map<String, Object> context,
            Map<String, Object> expected,
            Map<String, Object> constraints,
            String candidateOutput,
            Map<String, Object> ruleChecks,
            String baselineOutput
    ) {
        String judgePrompt = buildJudgePrompt(rubric, input, context, expected, constraints, candidateOutput, ruleChecks,
                baselineOutput);

        ProviderType provider = evalProperties.getJudge().getProvider();
        String model = evalProperties.getJudge().getModel();
        Double temperature = evalProperties.getJudge().getTemperature();
        int maxAttempts = resolveMaxAttempts();
        boolean rejudgeOnFail = evalProperties.getJudge().isRejudgeOnFail();

        List<Map<String, Object>> attemptSummaries = new ArrayList<>();
        AttemptEvaluation selected = null;
        AttemptEvaluation bestFailed = null;

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            EvalModelRunnerService.ModelExecution judgeExecution = evalModelRunnerService.run(
                    organizationId,
                    provider,
                    model,
                    judgePrompt,
                    temperature,
                    null
            );
            AttemptEvaluation evaluation = evaluateAttempt(judgeExecution, rubric, ruleChecks, attempt);
            attemptSummaries.add(evaluation.toSummary());

            if (evaluation.pass()) {
                selected = evaluation;
                break;
            }

            if (bestFailed == null || evaluation.overallScore() > bestFailed.overallScore()) {
                bestFailed = evaluation;
            }

            if (!rejudgeOnFail) {
                break;
            }
        }

        if (selected == null) {
            selected = bestFailed;
        }
        if (selected == null) {
            selected = fallbackAttemptEvaluation();
        }

        Map<String, Object> normalized = new LinkedHashMap<>();
        normalized.put("pass", selected.pass());
        normalized.put("scores", selected.normalizedScores());
        normalized.put("labels", toStringList(selected.raw().get("labels")));
        normalized.put("evidence", toStringList(selected.raw().get("evidence")));
        normalized.put("suggestions", toStringList(selected.raw().get("suggestions")));
        normalized.put("overallScore", selected.overallScore());
        normalized.put("judgeMeta", selected.judgeExecution().meta());
        if (attemptSummaries.size() > 1) {
            normalized.put("judgeAttempts", attemptSummaries);
            normalized.put("judgeDecisionStrategy", "PASS_IF_ANY_ELSE_BEST_SCORE");
        }

        return new JudgeResult(normalized, selected.overallScore(), selected.pass());
    }

    private AttemptEvaluation evaluateAttempt(
            EvalModelRunnerService.ModelExecution judgeExecution,
            ResolvedRubricConfig rubric,
            Map<String, Object> ruleChecks,
            int attempt
    ) {
        Map<String, Object> raw = parseJudgeOutput(judgeExecution.outputText());
        Map<String, Double> normalizedScores = normalizeScores(raw.get("scores"));

        double overallScore = computeOverallScore(normalizedScores, rubric.weights());
        boolean rulePass = readBoolean(ruleChecks != null ? ruleChecks.get("pass") : null);
        boolean modelPass = readBoolean(raw.get("pass"));
        boolean gatePass = passesGates(overallScore, ruleChecks, rubric.gates(), normalizedScores);
        boolean pass = modelPass && rulePass && gatePass;

        return new AttemptEvaluation(attempt, judgeExecution, raw, normalizedScores, overallScore, pass);
    }

    private int resolveMaxAttempts() {
        int configured = evalProperties.getJudge().getMaxAttempts();
        return Math.max(1, configured);
    }

    private AttemptEvaluation fallbackAttemptEvaluation() {
        EvalModelRunnerService.ModelExecution fallbackExecution = new EvalModelRunnerService.ModelExecution(
                "{}",
                Map.of()
        );
        Map<String, Object> raw = fallbackParseFailure("JUDGE_ATTEMPT_NOT_CREATED");
        return new AttemptEvaluation(1, fallbackExecution, raw, Map.of(), 0.0, false);
    }

    private String buildJudgePrompt(
            ResolvedRubricConfig rubric,
            String input,
            Map<String, Object> context,
            Map<String, Object> expected,
            Map<String, Object> constraints,
            String candidateOutput,
            Map<String, Object> ruleChecks,
            String baselineOutput
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("rubric", Map.of(
                "template", rubric.templateCode(),
                "description", rubric.description(),
                "weights", rubric.weights(),
                "gates", rubric.gates()
        ));
        payload.put("input", input);
        payload.put("context", context);
        payload.put("expected", expected);
        payload.put("constraints", constraints);
        payload.put("candidateOutput", candidateOutput);
        payload.put("ruleChecks", ruleChecks);
        payload.put("baselineOutput", baselineOutput);

        String payloadJson;
        try {
            payloadJson = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            log.error("Judge prompt payload 직렬화 실패", e);
            throw new IllegalStateException("Judge prompt payload serialization failed", e);
        }

        return """
                너는 프롬프트 평가 심사자다.
                아래 입력(JSON)을 읽고 candidateOutput만 평가하라.
                baselineOutput은 참고용이며 최종 pass 판단은 candidate 기준으로 하라.

                반드시 JSON 객체만 출력하라. Markdown, 코드블럭 금지.
                출력 스키마:
                {
                  "pass": true,
                  "scores": {"<criterion>": 1~5 숫자},
                  "labels": ["문제라벨"],
                  "evidence": ["근거"],
                  "suggestions": ["개선 제안"]
                }

                입력:
                %s
                """.formatted(payloadJson);
    }

    private Map<String, Object> parseJudgeOutput(String text) {
        try {
            String json = extractFirstJsonObject(text);
            if (json == null) {
                return fallbackParseFailure("JUDGE_JSON_NOT_FOUND");
            }
            return objectMapper.readValue(json, new TypeReference<>() {
            });
        } catch (Exception e) {
            return fallbackParseFailure("JUDGE_JSON_PARSE_FAIL");
        }
    }

    private Map<String, Object> fallbackParseFailure(String label) {
        Map<String, Object> fallback = new LinkedHashMap<>();
        fallback.put("pass", false);
        fallback.put("scores", Map.of());
        fallback.put("labels", List.of(label));
        fallback.put("evidence", List.of("judge output parse failed"));
        fallback.put("suggestions", List.of("judge 모델 응답 포맷을 점검하세요."));
        return fallback;
    }

    private String extractFirstJsonObject(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }

        String candidate = text.trim();
        if (candidate.startsWith("```") && candidate.endsWith("```")) {
            int start = candidate.indexOf('{');
            int end = candidate.lastIndexOf('}');
            if (start >= 0 && end > start) {
                candidate = candidate.substring(start, end + 1);
            }
        }

        int start = candidate.indexOf('{');
        if (start < 0) {
            return null;
        }

        int depth = 0;
        boolean inString = false;
        boolean escaping = false;
        for (int i = start; i < candidate.length(); i++) {
            char ch = candidate.charAt(i);
            if (inString) {
                if (escaping) {
                    escaping = false;
                    continue;
                }
                if (ch == '\\') {
                    escaping = true;
                    continue;
                }
                if (ch == '"') {
                    inString = false;
                }
                continue;
            }

            if (ch == '"') {
                inString = true;
            } else if (ch == '{') {
                depth++;
            } else if (ch == '}') {
                depth--;
                if (depth == 0) {
                    return candidate.substring(start, i + 1);
                }
            }
        }
        return null;
    }

    private Map<String, Double> normalizeScores(Object rawScores) {
        Map<String, Double> normalized = new LinkedHashMap<>();
        if (rawScores instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (entry.getKey() == null || entry.getValue() == null) {
                    continue;
                }
                String key = String.valueOf(entry.getKey());
                try {
                    double value = Double.parseDouble(String.valueOf(entry.getValue()));
                    if (value < 0) {
                        value = 0;
                    }
                    if (value > 5) {
                        value = 5;
                    }
                    normalized.put(key, value);
                } catch (NumberFormatException ignored) {
                }
            }
        }
        return normalized;
    }

    private double computeOverallScore(Map<String, Double> scores, Map<String, Double> weights) {
        double weightSum = 0.0;
        double weighted = 0.0;

        for (Map.Entry<String, Double> entry : weights.entrySet()) {
            String key = entry.getKey();
            double weight = entry.getValue() != null ? entry.getValue() : 0.0;
            if (weight <= 0) {
                continue;
            }
            double score = scores.getOrDefault(key, 0.0);
            weightSum += weight;
            weighted += (score / 5.0) * 100.0 * weight;
        }

        if (weightSum <= 0) {
            return 0.0;
        }

        return Math.round((weighted / weightSum) * 100.0) / 100.0;
    }

    private boolean passesGates(
            double overallScore,
            Map<String, Object> ruleChecks,
            Map<String, Object> gates,
            Map<String, Double> scores
    ) {
        Map<String, Object> safeGates = gates != null ? gates : Map.of();

        Object minOverallScoreObj = safeGates.get("minOverallScore");
        if (minOverallScoreObj != null) {
            try {
                double minOverall = Double.parseDouble(String.valueOf(minOverallScoreObj));
                if (overallScore < minOverall) {
                    return false;
                }
            } catch (NumberFormatException ignored) {
            }
        }

        Object requireJsonParsePassObj = safeGates.get("requireJsonParsePass");
        boolean requireJsonParsePass = readBoolean(requireJsonParsePassObj);
        if (requireJsonParsePass) {
            Object jsonParse = ruleChecks != null ? ruleChecks.get("json_parse") : null;
            if (!"PASS".equals(jsonParse)) {
                return false;
            }
        }

        Object minCriterionScoresObj = safeGates.get("minCriterionScores");
        if (minCriterionScoresObj instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (entry.getKey() == null || entry.getValue() == null) {
                    continue;
                }
                String criterion = String.valueOf(entry.getKey());
                Double minScore = readDouble(entry.getValue());
                if (minScore == null) {
                    continue;
                }
                double actualScore = scores.getOrDefault(criterion, 0.0);
                if (actualScore < minScore) {
                    return false;
                }
            }
        }

        return true;
    }

    private static boolean readBoolean(Object value) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        if (value == null) {
            return false;
        }
        return "true".equalsIgnoreCase(String.valueOf(value));
    }

    private static List<String> toStringList(Object value) {
        List<String> result = new ArrayList<>();
        if (value instanceof List<?> list) {
            for (Object item : list) {
                if (item != null) {
                    result.add(String.valueOf(item));
                }
            }
        }
        return result;
    }

    private static Double readDouble(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private record AttemptEvaluation(
            int attempt,
            EvalModelRunnerService.ModelExecution judgeExecution,
            Map<String, Object> raw,
            Map<String, Double> normalizedScores,
            double overallScore,
            boolean pass
    ) {
        Map<String, Object> toSummary() {
            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("attempt", attempt);
            summary.put("pass", pass);
            summary.put("overallScore", overallScore);
            summary.put("labels", toStringList(raw.get("labels")));
            return summary;
        }
    }

    public record JudgeResult(Map<String, Object> judgeOutput, double overallScore, boolean pass) {
    }
}
