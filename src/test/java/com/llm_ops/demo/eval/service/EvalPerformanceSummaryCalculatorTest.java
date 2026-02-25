package com.llm_ops.demo.eval.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class EvalPerformanceSummaryCalculatorTest {

    private final EvalPerformanceSummaryCalculator calculator = new EvalPerformanceSummaryCalculator();

    @Test
    @DisplayName("단일 모드 성능 요약은 평균/퍼센타일 지표를 계산한다")
    void 단일_모드_성능_요약은_평균_퍼센타일_지표를_계산한다() {
        // given
        List<Map<String, Object>> candidateMetas = List.of(
                Map.of("totalTokens", 100, "estimatedCostUsd", 0.01, "latencyMs", 200),
                Map.of("totalTokens", 200, "estimatedCostUsd", 0.03, "latencyMs", 300),
                Map.of("totalTokens", 300, "estimatedCostUsd", 0.05, "latencyMs", 1000)
        );

        // when
        Map<String, Object> summary = calculator.buildSummary(candidateMetas, List.of(), false);
        Map<String, Object> candidate = toObjectMap(summary.get("candidate"));

        // then
        assertThat(candidate.get("avgTokensPerCase")).isEqualTo(200.0);
        assertThat(candidate.get("avgCostUsdPerCase")).isEqualTo(0.03);
        assertThat(candidate.get("avgLatencyMs")).isEqualTo(500.0);
        assertThat(candidate.get("p95LatencyMs")).isEqualTo(1000.0);
        assertThat(candidate.get("sampleSize")).isEqualTo(3);
        assertThat(summary).doesNotContainKey("baseline");
        assertThat(summary).doesNotContainKey("delta");
    }

    @Test
    @DisplayName("비교 모드 성능 요약은 baseline 대비 delta와 deltaPct를 계산한다")
    void 비교_모드_성능_요약은_baseline_대비_delta와_deltaPct를_계산한다() {
        // given
        List<Map<String, Object>> candidateMetas = List.of(
                Map.of("totalTokens", 200, "estimatedCostUsd", 0.02, "latencyMs", 220),
                Map.of("totalTokens", 100, "estimatedCostUsd", 0.01, "latencyMs", 440)
        );
        List<Map<String, Object>> baselineMetas = List.of(
                Map.of("totalTokens", 100, "estimatedCostUsd", 0.01, "latencyMs", 110),
                Map.of("totalTokens", 100, "estimatedCostUsd", 0.01, "latencyMs", 220)
        );

        // when
        Map<String, Object> summary = calculator.buildSummary(candidateMetas, baselineMetas, true);
        Map<String, Object> delta = toObjectMap(summary.get("delta"));

        Map<String, Object> tokensDelta = toObjectMap(delta.get("avgTokensPerCase"));
        Map<String, Object> costDelta = toObjectMap(delta.get("avgCostUsdPerCase"));
        Map<String, Object> p95Delta = toObjectMap(delta.get("p95LatencyMs"));

        // then
        assertThat(tokensDelta.get("value")).isEqualTo(50.0);
        assertThat(tokensDelta.get("pct")).isEqualTo(50.0);
        assertThat(costDelta.get("value")).isEqualTo(0.005);
        assertThat(costDelta.get("pct")).isEqualTo(50.0);
        assertThat(p95Delta.get("value")).isEqualTo(220.0);
        assertThat(p95Delta.get("pct")).isEqualTo(100.0);
    }

    @Test
    @DisplayName("baseline이 0이면 deltaPct는 null로 계산한다")
    void baseline이_0이면_deltaPct는_null로_계산한다() {
        // given
        List<Map<String, Object>> candidateMetas = List.of(
                Map.of("totalTokens", 10, "estimatedCostUsd", 0.001, "latencyMs", 100)
        );
        List<Map<String, Object>> baselineMetas = List.of(
                Map.of("totalTokens", 0, "estimatedCostUsd", 0.0, "latencyMs", 0)
        );

        // when
        Map<String, Object> summary = calculator.buildSummary(candidateMetas, baselineMetas, true);
        Map<String, Object> delta = toObjectMap(summary.get("delta"));
        Map<String, Object> tokensDelta = toObjectMap(delta.get("avgTokensPerCase"));
        Map<String, Object> costDelta = toObjectMap(delta.get("avgCostUsdPerCase"));
        Map<String, Object> latencyDelta = toObjectMap(delta.get("avgLatencyMs"));

        // then
        assertThat(tokensDelta.get("pct")).isNull();
        assertThat(costDelta.get("pct")).isNull();
        assertThat(latencyDelta.get("pct")).isNull();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> toObjectMap(Object value) {
        return (Map<String, Object>) value;
    }
}
