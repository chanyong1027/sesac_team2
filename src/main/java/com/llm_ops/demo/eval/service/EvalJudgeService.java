package com.llm_ops.demo.eval.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.llm_ops.demo.eval.config.EvalProperties;
import com.llm_ops.demo.eval.domain.EvalMode;
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

        List<String> evidence = toStringList(selected.raw().get("evidence"));
        String reason = normalizeReasonText(selected.raw().get("reason"), evidence, selected.pass());

        Map<String, Object> normalized = new LinkedHashMap<>();
        normalized.put("pass", selected.pass());
        normalized.put("scores", selected.normalizedScores());
        normalized.put("labels", toStringList(selected.raw().get("labels")));
        normalized.put("reason", reason);
        normalized.put("evidence", evidence);
        normalized.put("suggestions", toStringList(selected.raw().get("suggestions")));
        normalized.put("overallScore", selected.overallScore());
        normalized.put("judgeMeta", selected.judgeExecution().meta());
        if (attemptSummaries.size() > 1) {
            normalized.put("judgeAttempts", attemptSummaries);
            normalized.put("judgeDecisionStrategy", "PASS_IF_ANY_ELSE_BEST_SCORE");
        }

        return new JudgeResult(normalized, selected.overallScore(), selected.pass());
    }

    public RunOverallReviewResult summarizeRun(
            Long organizationId,
            EvalMode mode,
            Map<String, Object> summary,
            List<Map<String, Object>> caseHighlights
    ) {
        String reviewPrompt = buildRunOverallReviewPrompt(mode, summary, caseHighlights);
        ProviderType provider = evalProperties.getJudge().getProvider();
        String model = evalProperties.getJudge().getModel();
        Double temperature = evalProperties.getJudge().getTemperature();

        EvalModelRunnerService.ModelExecution reviewExecution = evalModelRunnerService.run(
                organizationId,
                provider,
                model,
                reviewPrompt,
                temperature,
                null
        );

        Map<String, Object> raw = parseRunOverallReviewOutput(reviewExecution.outputText());
        Map<String, Object> normalized = normalizeRunOverallReview(raw);
        return new RunOverallReviewResult(normalized, reviewExecution.meta());
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

    private String buildRunOverallReviewPrompt(
            EvalMode mode,
            Map<String, Object> summary,
            List<Map<String, Object>> caseHighlights
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("mode", mode != null ? mode.name() : null);
        payload.put("summary", summary);
        payload.put("caseHighlights", caseHighlights);

        String payloadJson;
        try {
            payloadJson = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            log.error("Run overall review payload 직렬화 실패", e);
            throw new IllegalStateException("Run overall review payload serialization failed", e);
        }

        return """
                너는 프롬프트 평가 실행 결과를 종합해 최종 리뷰를 작성하는 운영 리뷰어다.
                입력 JSON(run summary + 대표 케이스)을 읽고, 아래 스키마의 JSON 객체만 출력하라.
                Markdown, 코드블럭, 설명 문장 금지.

                출력 스키마:
                {
                  "overallComment": "전체 케이스를 종합한 한두 문장 요약 (한국어)",
                  "verdictReason": "현재 판정(pass/hold)의 핵심 사유 1문장 (한국어)",
                  "strengths": ["강점 1", "강점 2"],
                  "risks": ["리스크 1", "리스크 2"],
                  "nextActions": ["다음 액션 1", "다음 액션 2"]
                }

                작성 규칙:
                - 전체 필드는 한국어로 작성하라.
                - strengths/risks/nextActions는 각각 최대 3개로 제한하라.
                - verdictReason에는 수치 근거(passRate/score/errorRate 또는 compare delta)를 포함하라.
                - 입력 데이터에 없는 사실을 지어내지 마라.

                입력:
                %s
                """.formatted(payloadJson);
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
        boolean isCustomRubric = "CUSTOM".equalsIgnoreCase(rubric.templateCode());
        Map<String, String> criteriaDefinitions = isCustomRubric
                ? extractCriteriaDefinitions(rubric.description(), rubric.weights())
                : Map.of();
        List<String> missingCriteriaDefinitions = isCustomRubric
                ? listMissingCriteriaDefinitionKeys(rubric.weights(), criteriaDefinitions)
                : List.of();

        Map<String, Object> payload = new LinkedHashMap<>();
        Map<String, Object> rubricPayload = new LinkedHashMap<>();
        rubricPayload.put("template", rubric.templateCode());
        rubricPayload.put("description", rubric.description());
        rubricPayload.put("weights", rubric.weights());
        rubricPayload.put("gates", rubric.gates());
        if (isCustomRubric) {
            rubricPayload.put("criteriaDefinitions", criteriaDefinitions);
            rubricPayload.put("missingCriteriaDefinitions", missingCriteriaDefinitions);
        }
        payload.put("rubric", rubricPayload);
        payload.put("input", input);
        payload.put("context", context);
        payload.put("expected", sanitizeForJudge(expected));
        payload.put("constraints", sanitizeForJudge(constraints));
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

        String customRubricInstructions = isCustomRubric
                ? """
                - CUSTOM 루브릭은 rubric.weights의 키 이름만으로는 의미가 모호할 수 있다.
                  rubric.criteriaDefinitions(또는 rubric.description의 `key: 의미` 라인)을 기준으로 각 항목 점수를 산정하라.
                  missingCriteriaDefinitions가 비어있지 않다면 labels에 "RUBRIC_CRITERION_DEFINITION_MISSING" 를 포함하고 evidence에 누락 키를 나열하라.

                """
                : "";

        return """
                너는 프롬프트 평가 심사자다.
                아래 입력(JSON)을 읽고 candidateOutput만 평가하라.
                baselineOutput은 참고용이며 최종 pass 판단은 candidate 기준으로 하라.

                반드시 JSON 객체만 출력하라. Markdown, 코드블럭 금지.
                출력 스키마:
                {
                  "pass": true,
                  "reason": "실패 사유: 핵심 누락 ...",
                  "scores": {"<criterion>": 1~5 숫자},
                  "labels": ["문제라벨"],
                  "evidence": ["근거"],
                  "suggestions": ["개선 제안"],
                  "mustCoverChecks": [{"item":"핵심포인트","covered":true,"note":"한줄근거"}]
                }

                해석 규칙:
                - scores는 rubric.weights에 있는 모든 criterion 키를 반드시 포함해야 한다(각 1~5점).
                - reason은 반드시 한국어 한 문장으로 작성하라.
                  pass=false면 "실패 사유: ..." 형식, pass=true면 "판정 사유: ..." 형식으로 시작하라.
                - expected.must_cover 가 있으면, 각 항목이 candidateOutput에 "의미적으로" 포함/해결되었는지 판단하라(동의어/다른 표현 허용).
                  하나라도 누락되면 pass=false 로 두고 labels에 "MISSING_MUST_COVER" 를 포함하라.
                  mustCoverChecks에 항목별 covered=true/false를 채우고, 누락 항목은 evidence에 명시하라.
                - ruleChecks는 하드 룰(형식/길이/JSON/스키마/금지 키워드 등) 결과이므로, ruleChecks.pass=false 인 경우 pass는 false여야 한다.
                - ruleChecks.warningChecks는 소프트 경고다(예: must_include 누락). warningChecks만으로 pass를 false로 바꾸지 말고 labels/evidence/suggestions에 개선 포인트로 반영하라.
                - 키워드 문자열 체크(must_include/must_not_include 등)는 ruleChecks에서 이미 판정된다. 너는 candidateOutput을 다시 문자열로 재검증하지 말고 ruleChecks만 따르라.
                - ruleChecks에서 실패가 있으면 reason/evidence에 어떤 룰 키가 실패했는지(예: must_include) 명시하라.
                - must_cover 누락이 있으면 reason/evidence에 누락 항목명을 구체적으로 명시하라.

                %s
                입력:
                %s
                """.formatted(customRubricInstructions, payloadJson);
    }

    private static Map<String, Object> sanitizeForJudge(Map<String, Object> value) {
        if (value == null || value.isEmpty()) {
            return value;
        }
        Map<String, Object> copy = new LinkedHashMap<>(value);
        copy.remove("must_include");
        copy.remove("must_not_include");
        copy.remove("keyword_normalization");
        copy.remove("keyword_normalize");
        copy.remove("forbidden_words");
        return copy;
    }

    private static Map<String, String> extractCriteriaDefinitions(String description, Map<String, Double> weights) {
        if (description == null || description.isBlank() || weights == null || weights.isEmpty()) {
            return Map.of();
        }

        Map<String, String> canonicalKeyByLower = new LinkedHashMap<>();
        for (String key : weights.keySet()) {
            if (key == null || key.isBlank()) {
                continue;
            }
            canonicalKeyByLower.put(key.trim().toLowerCase(), key);
        }

        Map<String, String> definitions = new LinkedHashMap<>();
        for (String rawLine : description.split("\\R")) {
            if (rawLine == null) {
                continue;
            }
            String line = rawLine.trim();
            if (line.isEmpty()) {
                continue;
            }

            // Allow simple bullets: "- key: meaning"
            line = line.replaceFirst("^[\\s\\-*]+", "");
            int colonIndex = line.indexOf(':');
            if (colonIndex <= 0) {
                continue;
            }

            String candidateKey = line.substring(0, colonIndex).trim();
            String meaning = line.substring(colonIndex + 1).trim();
            if (candidateKey.isEmpty() || meaning.isEmpty()) {
                continue;
            }

            String canonicalKey = canonicalKeyByLower.get(candidateKey.toLowerCase());
            if (canonicalKey == null) {
                continue;
            }
            definitions.putIfAbsent(canonicalKey, meaning);
        }

        return definitions;
    }

    private static List<String> listMissingCriteriaDefinitionKeys(
            Map<String, Double> weights,
            Map<String, String> criteriaDefinitions
    ) {
        if (weights == null || weights.isEmpty()) {
            return List.of();
        }
        List<String> missing = new ArrayList<>();
        for (String key : weights.keySet()) {
            if (key == null) {
                continue;
            }
            if (criteriaDefinitions == null || !criteriaDefinitions.containsKey(key)) {
                missing.add(key);
            }
        }
        return missing;
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
        fallback.put("reason", "실패 사유: 심사 결과(JSON) 파싱에 실패했습니다.");
        fallback.put("scores", Map.of());
        fallback.put("labels", List.of(label));
        fallback.put("evidence", List.of("심사 모델 응답에서 JSON 객체를 찾지 못했거나 파싱에 실패했습니다."));
        fallback.put("suggestions", List.of("judge 모델 응답 포맷을 점검하세요."));
        return fallback;
    }

    private Map<String, Object> parseRunOverallReviewOutput(String text) {
        try {
            String json = extractFirstJsonObject(text);
            if (json == null) {
                return fallbackRunOverallReview("RUN_OVERALL_REVIEW_JSON_NOT_FOUND");
            }
            return objectMapper.readValue(json, new TypeReference<>() {
            });
        } catch (Exception e) {
            return fallbackRunOverallReview("RUN_OVERALL_REVIEW_JSON_PARSE_FAIL");
        }
    }

    private Map<String, Object> fallbackRunOverallReview(String label) {
        Map<String, Object> fallback = new LinkedHashMap<>();
        fallback.put("overallComment", "전체 결과를 기반으로 한 종합평가를 생성하지 못했습니다.");
        fallback.put("verdictReason", "판정 사유를 자동 분석하지 못했습니다.");
        fallback.put("strengths", List.of());
        fallback.put("risks", List.of("LLM 종합평가 생성 실패"));
        fallback.put("nextActions", List.of("실행 로그를 확인한 뒤 다시 실행해 주세요."));
        fallback.put("labels", List.of(label));
        return fallback;
    }

    private Map<String, Object> normalizeRunOverallReview(Map<String, Object> raw) {
        Map<String, Object> normalized = new LinkedHashMap<>();

        String overallComment = trimToNull(raw != null ? raw.get("overallComment") : null);
        String verdictReason = trimToNull(raw != null ? raw.get("verdictReason") : null);
        List<String> strengths = limitNonBlankStrings(toStringList(raw != null ? raw.get("strengths") : null), 3);
        List<String> risks = limitNonBlankStrings(toStringList(raw != null ? raw.get("risks") : null), 3);
        List<String> nextActions = limitNonBlankStrings(toStringList(raw != null ? raw.get("nextActions") : null), 3);
        List<String> labels = limitNonBlankStrings(toStringList(raw != null ? raw.get("labels") : null), 5);

        normalized.put(
                "overallComment",
                overallComment != null ? overallComment : "전체 케이스 결과를 종합하는 중 문제가 발생했습니다."
        );
        normalized.put(
                "verdictReason",
                verdictReason != null ? verdictReason : "판정 근거를 자동 생성하지 못했습니다."
        );
        normalized.put("strengths", strengths);
        normalized.put("risks", risks);
        normalized.put("nextActions", nextActions);
        if (!labels.isEmpty()) {
            normalized.put("labels", labels);
        }
        return normalized;
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

    private static String trimToNull(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static List<String> limitNonBlankStrings(List<String> source, int limit) {
        List<String> result = new ArrayList<>();
        if (source == null || source.isEmpty() || limit <= 0) {
            return result;
        }
        for (String item : source) {
            if (item == null) {
                continue;
            }
            String trimmed = item.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            result.add(trimmed);
            if (result.size() >= limit) {
                break;
            }
        }
        return result;
    }

    private static String normalizeReasonText(Object rawReason, List<String> evidence, boolean pass) {
        String prefix = pass ? "판정 사유: " : "실패 사유: ";
        String reason = rawReason != null ? String.valueOf(rawReason).trim() : "";

        if (reason.isBlank() && evidence != null && !evidence.isEmpty()) {
            reason = evidence.get(0);
        }
        if (reason.isBlank()) {
            reason = pass ? "평가 기준을 충족했습니다." : "평가 기준을 충족하지 못했습니다.";
        }

        if (reason.startsWith("실패 사유:") || reason.startsWith("판정 사유:")) {
            return reason;
        }
        return prefix + reason;
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

    public record RunOverallReviewResult(Map<String, Object> review, Map<String, Object> meta) {
    }
}
