package com.llm_ops.demo.eval.rubric;

import java.util.Map;

public record RubricTemplateDefinition(
        String description,
        Map<String, Double> defaultWeights,
        Map<String, Object> defaultGates
) {
}
