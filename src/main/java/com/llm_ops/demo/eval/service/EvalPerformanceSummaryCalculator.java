package com.llm_ops.demo.eval.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class EvalPerformanceSummaryCalculator {

    public Map<String, Object> buildSummary(
            List<Map<String, Object>> candidateMetas,
            List<Map<String, Object>> baselineMetas,
            boolean compareMode
    ) {
        PerformanceSnapshot candidate = PerformanceSnapshot.from(candidateMetas);
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("candidate", candidate.toMap());

        if (!compareMode) {
            return summary;
        }

        PerformanceSnapshot baseline = PerformanceSnapshot.from(baselineMetas);
        summary.put("baseline", baseline.toMap());
        summary.put("delta", buildDelta(candidate, baseline));
        return summary;
    }

    private Map<String, Object> buildDelta(PerformanceSnapshot candidate, PerformanceSnapshot baseline) {
        Map<String, Object> delta = new LinkedHashMap<>();
        delta.put("avgTokensPerCase", metricDelta(candidate.avgTokensPerCase, baseline.avgTokensPerCase, 2));
        delta.put("avgCostUsdPerCase", metricDelta(candidate.avgCostUsdPerCase, baseline.avgCostUsdPerCase, 6));
        delta.put("avgLatencyMs", metricDelta(candidate.avgLatencyMs, baseline.avgLatencyMs, 2));
        delta.put("p95LatencyMs", metricDelta(candidate.p95LatencyMs, baseline.p95LatencyMs, 2));
        return delta;
    }

    private Map<String, Object> metricDelta(Double candidate, Double baseline, int valueScale) {
        Map<String, Object> result = new LinkedHashMap<>();
        if (candidate == null || baseline == null) {
            result.put("value", null);
            result.put("pct", null);
            return result;
        }

        double diff = candidate - baseline;
        result.put("value", round(diff, valueScale));

        if (Math.abs(baseline) < 0.0000001d) {
            result.put("pct", null);
        } else {
            result.put("pct", round((diff / baseline) * 100.0, 2));
        }
        return result;
    }

    private static Double readDouble(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static Double average(List<Double> values, int scale) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        double sum = values.stream().mapToDouble(Double::doubleValue).sum();
        return round(sum / values.size(), scale);
    }

    private static Double percentile95(List<Double> values, int scale) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        List<Double> sorted = values.stream().sorted().toList();
        int rank = (int) Math.ceil(sorted.size() * 0.95d) - 1;
        int index = Math.max(0, Math.min(rank, sorted.size() - 1));
        return round(sorted.get(index), scale);
    }

    private static double round(double value, int scale) {
        return BigDecimal.valueOf(value).setScale(scale, RoundingMode.HALF_UP).doubleValue();
    }

    private record PerformanceSnapshot(
            Double avgTokensPerCase,
            Double avgCostUsdPerCase,
            Double avgLatencyMs,
            Double p95LatencyMs,
            int sampleSize,
            int tokenSampleSize,
            int costSampleSize,
            int latencySampleSize
    ) {
        static PerformanceSnapshot from(List<Map<String, Object>> metas) {
            List<Double> tokenValues = new ArrayList<>();
            List<Double> costValues = new ArrayList<>();
            List<Double> latencyValues = new ArrayList<>();
            int sampleSize = 0;

            if (metas != null) {
                for (Map<String, Object> meta : metas) {
                    if (meta == null || meta.isEmpty()) {
                        continue;
                    }

                    Double tokens = readDouble(meta.get("totalTokens"));
                    Double cost = readDouble(meta.get("estimatedCostUsd"));
                    Double latency = readDouble(meta.get("latencyMs"));

                    if (tokens != null) {
                        tokenValues.add(tokens);
                    }
                    if (cost != null) {
                        costValues.add(cost);
                    }
                    if (latency != null) {
                        latencyValues.add(latency);
                    }
                    if (tokens != null || cost != null || latency != null) {
                        sampleSize++;
                    }
                }
            }

            return new PerformanceSnapshot(
                    average(tokenValues, 2),
                    average(costValues, 6),
                    average(latencyValues, 2),
                    percentile95(latencyValues, 2),
                    sampleSize,
                    tokenValues.size(),
                    costValues.size(),
                    latencyValues.size()
            );
        }

        Map<String, Object> toMap() {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("avgTokensPerCase", avgTokensPerCase);
            map.put("avgCostUsdPerCase", avgCostUsdPerCase);
            map.put("avgLatencyMs", avgLatencyMs);
            map.put("p95LatencyMs", p95LatencyMs);
            map.put("sampleSize", sampleSize);
            map.put("tokenSampleSize", tokenSampleSize);
            map.put("costSampleSize", costSampleSize);
            map.put("latencySampleSize", latencySampleSize);
            return map;
        }
    }
}
