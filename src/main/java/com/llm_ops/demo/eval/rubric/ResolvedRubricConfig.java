package com.llm_ops.demo.eval.rubric;

import java.util.Map;

public record ResolvedRubricConfig(
        String templateCode,
        String description,
        Map<String, Double> weights,
        Map<String, Object> gates,
        Map<String, Map<String, String>> criteriaAnchors
) {
}
