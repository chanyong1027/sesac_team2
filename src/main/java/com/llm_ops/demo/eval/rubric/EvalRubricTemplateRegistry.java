package com.llm_ops.demo.eval.rubric;

import com.llm_ops.demo.eval.domain.RubricTemplateCode;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class EvalRubricTemplateRegistry {

    public RubricTemplateDefinition get(RubricTemplateCode code) {
        return switch (code) {
            case GENERAL_TEXT -> new RubricTemplateDefinition(
                    "General quality for free-form text.",
                    Map.of(
                            "relevance", 1.0,
                            "completeness", 1.0,
                            "clarity", 1.0,
                            "safety", 1.0
                    ),
                    Map.of("minOverallScore", 70.0)
            );
            case SUMMARY -> new RubricTemplateDefinition(
                    "Summary quality for coverage and faithfulness.",
                    Map.of(
                            "coverage", 1.0,
                            "faithfulness", 1.2,
                            "conciseness", 0.8,
                            "format", 1.0
                    ),
                    Map.of("minOverallScore", 72.0)
            );
            case JSON_EXTRACTION -> new RubricTemplateDefinition(
                    "Structured extraction quality with schema discipline.",
                    Map.of(
                            "format", 1.3,
                            "schema", 1.3,
                            "value_correctness", 1.0,
                            "extraneous_text", 0.8
                    ),
                    Map.of("requireJsonParsePass", true, "minOverallScore", 75.0)
            );
            case CLASSIFICATION -> new RubricTemplateDefinition(
                    "Classification quality and label validity.",
                    Map.of(
                            "label_valid", 1.2,
                            "correctness", 1.1,
                            "consistency", 1.0
                    ),
                    Map.of("minOverallScore", 75.0)
            );
            case CUSTOM -> new RubricTemplateDefinition(
                    "Custom rubric. Override weights/gates as needed.",
                    Map.of(
                            "quality", 1.0
                    ),
                    Map.of("minOverallScore", 70.0)
            );
        };
    }

    @SuppressWarnings("unchecked")
    public ResolvedRubricConfig resolve(RubricTemplateCode code, Map<String, Object> overrides) {
        RubricTemplateDefinition definition = get(code);
        String description = definition.description();

        Map<String, Double> weights = new LinkedHashMap<>(definition.defaultWeights());
        Map<String, Object> gates = new LinkedHashMap<>(definition.defaultGates());

        if (overrides != null) {
            Object weightsObj = overrides.get("weights");
            if (weightsObj instanceof Map<?, ?> map) {
                for (Map.Entry<?, ?> entry : map.entrySet()) {
                    if (entry.getKey() == null || entry.getValue() == null) {
                        continue;
                    }
                    try {
                        weights.put(String.valueOf(entry.getKey()), Double.parseDouble(String.valueOf(entry.getValue())));
                    } catch (NumberFormatException ignored) {
                    }
                }
            }
            Object gatesObj = overrides.get("gates");
            if (gatesObj instanceof Map<?, ?> map) {
                for (Map.Entry<?, ?> entry : map.entrySet()) {
                    if (entry.getKey() != null) {
                        gates.put(String.valueOf(entry.getKey()), entry.getValue());
                    }
                }
            }

            Object descriptionObj = overrides.get("description");
            if (descriptionObj != null) {
                String overrideDescription = String.valueOf(descriptionObj).trim();
                if (!overrideDescription.isBlank()) {
                    description = overrideDescription;
                }
            }
        }

        if (weights.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "Rubric weights가 비어있습니다.");
        }

        return new ResolvedRubricConfig(code.name(), description, weights, gates);
    }
}
