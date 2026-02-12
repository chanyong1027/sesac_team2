package com.llm_ops.demo.eval.service;

import com.llm_ops.demo.eval.domain.EvalMode;
import com.llm_ops.demo.eval.domain.EvalReleaseCriteria;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class EvalReleaseDecisionCalculator {

    public EvalReleaseDecision calculate(
            EvalMode mode,
            EvalReleaseCriteria criteria,
            double passRate,
            double avgOverallScore,
            double errorRate,
            Double avgScoreDelta
    ) {
        List<String> blockingReasons = new ArrayList<>();
        List<String> warningReasons = new ArrayList<>();

        if (passRate < safeValue(criteria.getMinPassRate())) {
            blockingReasons.add("PASS_RATE_BELOW_THRESHOLD");
        }
        if (avgOverallScore < safeValue(criteria.getMinAvgOverallScore())) {
            blockingReasons.add("AVG_SCORE_BELOW_THRESHOLD");
        }
        if (errorRate > safeValue(criteria.getMaxErrorRate())) {
            blockingReasons.add("ERROR_RATE_ABOVE_THRESHOLD");
        }

        if (mode == EvalMode.COMPARE_ACTIVE && avgScoreDelta != null) {
            if (avgScoreDelta < 0) {
                blockingReasons.add("COMPARE_REGRESSION_DETECTED");
            } else if (avgScoreDelta < safeValue(criteria.getMinImprovementNoticeDelta())) {
                warningReasons.add("COMPARE_IMPROVEMENT_MINOR");
            }
        }

        String releaseDecision = blockingReasons.isEmpty()
                ? EvalReleaseDecision.SAFE_TO_DEPLOY
                : EvalReleaseDecision.HOLD;

        String riskLevel = resolveRiskLevel(blockingReasons, warningReasons);

        List<String> reasons = new ArrayList<>(blockingReasons);
        reasons.addAll(warningReasons);

        return new EvalReleaseDecision(
                releaseDecision,
                riskLevel,
                reasons,
                EvalReleaseDecision.BASIS_RUN_SNAPSHOT
        );
    }

    private static String resolveRiskLevel(List<String> blockingReasons, List<String> warningReasons) {
        if (!blockingReasons.isEmpty()) {
            if (blockingReasons.contains("COMPARE_REGRESSION_DETECTED")
                    || blockingReasons.contains("ERROR_RATE_ABOVE_THRESHOLD")) {
                return "HIGH";
            }
            return "MEDIUM";
        }
        if (!warningReasons.isEmpty()) {
            return "MEDIUM";
        }
        return "LOW";
    }

    private static double safeValue(Double value) {
        if (value == null || Double.isNaN(value) || Double.isInfinite(value)) {
            return 0.0;
        }
        return value;
    }
}
