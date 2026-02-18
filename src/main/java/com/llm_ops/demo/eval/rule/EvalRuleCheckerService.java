package com.llm_ops.demo.eval.rule;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.llm_ops.demo.eval.domain.RubricTemplateCode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class EvalRuleCheckerService {

    private final ObjectMapper objectMapper;

    public EvalRuleCheckerService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> check(
            String output,
            Map<String, Object> constraints,
            Map<String, Object> expected,
            RubricTemplateCode rubricTemplateCode
    ) {
        Map<String, Object> result = new LinkedHashMap<>();
        List<String> failures = new ArrayList<>();

        Map<String, Object> safeConstraints = constraints != null ? constraints : Map.of();
        Map<String, Object> safeExpected = expected != null ? expected : Map.of();

        int maxChars = readInt(safeConstraints.get("max_chars"));
        int maxLines = readInt(safeConstraints.get("max_lines"));

        if (maxChars > 0) {
            boolean pass = output != null && output.length() <= maxChars;
            result.put("max_chars", pass ? "PASS" : "FAIL");
            if (!pass) {
                failures.add("max_chars");
            }
        }

        if (maxLines > 0) {
            int lines = output == null || output.isBlank() ? 0 : output.split("\\R").length;
            boolean pass = lines <= maxLines;
            result.put("max_lines", pass ? "PASS" : "FAIL");
            if (!pass) {
                failures.add("max_lines");
            }
        }

        List<String> mustInclude = readStringList(safeConstraints.get("must_include"));
        if (mustInclude.isEmpty()) {
            mustInclude = readStringList(safeExpected.get("must_include"));
        }
        if (!mustInclude.isEmpty()) {
            boolean pass = true;
            for (String token : mustInclude) {
                if (output == null || !output.contains(token)) {
                    pass = false;
                    break;
                }
            }
            result.put("must_include", pass ? "PASS" : "FAIL");
            if (!pass) {
                failures.add("must_include");
            }
        }

        List<String> mustNotInclude = readStringList(safeConstraints.get("must_not_include"));
        if (mustNotInclude.isEmpty()) {
            mustNotInclude = readStringList(safeExpected.get("must_not_include"));
        }
        if (!mustNotInclude.isEmpty()) {
            boolean pass = true;
            for (String token : mustNotInclude) {
                if (output != null && output.contains(token)) {
                    pass = false;
                    break;
                }
            }
            result.put("must_not_include", pass ? "PASS" : "FAIL");
            if (!pass) {
                failures.add("must_not_include");
            }
        }

        boolean jsonRequired = "json_only".equalsIgnoreCase(String.valueOf(safeConstraints.get("format")))
                || rubricTemplateCode == RubricTemplateCode.JSON_EXTRACTION;

        Map<String, Object> parsedJson = null;
        if (jsonRequired) {
            try {
                parsedJson = objectMapper.readValue(output, new TypeReference<>() {});
                result.put("json_parse", "PASS");
            } catch (Exception e) {
                result.put("json_parse", "FAIL");
                failures.add("json_parse");
            }
        }

        List<String> requiredKeys = readStringList(safeConstraints.get("required_keys"));
        if (requiredKeys.isEmpty()) {
            requiredKeys = readStringList(safeExpected.get("required_keys"));
        }
        if (!requiredKeys.isEmpty()) {
            if (parsedJson == null && output != null && !output.isBlank()) {
                try {
                    // required_keys가 있으면 format=json_only가 아니어도 JSON 스키마를 점검한다.
                    parsedJson = objectMapper.readValue(output, new TypeReference<>() {});
                } catch (Exception ignored) {
                    // JSON 파싱 실패 시 schema 체크는 FAIL 처리된다.
                }
            }

            boolean schemaPass = parsedJson != null;
            if (schemaPass) {
                for (String key : requiredKeys) {
                    if (!parsedJson.containsKey(key)) {
                        schemaPass = false;
                        break;
                    }
                }
            }
            result.put("schema", schemaPass ? "PASS" : "FAIL");
            if (!schemaPass) {
                failures.add("schema");
            }
        }

        result.put("pass", failures.isEmpty());
        result.put("failedChecks", failures);
        return result;
    }

    private static int readInt(Object value) {
        if (value == null) {
            return 0;
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private static List<String> readStringList(Object value) {
        if (value instanceof List<?> list) {
            return list.stream().map(String::valueOf).toList();
        }
        return List.of();
    }
}
