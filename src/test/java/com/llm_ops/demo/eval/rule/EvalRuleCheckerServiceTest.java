package com.llm_ops.demo.eval.rule;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.llm_ops.demo.eval.domain.RubricTemplateCode;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class EvalRuleCheckerServiceTest {

    private final EvalRuleCheckerService service = new EvalRuleCheckerService(new ObjectMapper());

    @Test
    @DisplayName("JSON 추출 룰을 만족하면 pass=true를 반환한다")
    void JSON_추출_룰을_만족하면_pass_true를_반환한다() {
        // given
        String output = "{\"answer\":\"ok\",\"category\":\"refund\"}";
        Map<String, Object> constraints = Map.of(
                "format", "json_only",
                "required_keys", List.of("answer", "category")
        );

        // when
        Map<String, Object> result = service.check(output, constraints, null, RubricTemplateCode.JSON_EXTRACTION);

        // then
        assertThat(result.get("pass")).isEqualTo(true);
        assertThat(result.get("json_parse")).isEqualTo("PASS");
        assertThat(result.get("schema")).isEqualTo("PASS");
    }

    @Test
    @DisplayName("must_include 룰을 위반하면 실패 항목에 기록된다")
    @SuppressWarnings("unchecked")
    void must_include_룰_위반시_실패항목에_기록된다() {
        // given
        String output = "환불은 접수 후 처리됩니다.";
        Map<String, Object> constraints = Map.of(
                "must_include", List.of("영업일", "환불")
        );

        // when
        Map<String, Object> result = service.check(output, constraints, null, RubricTemplateCode.GENERAL_TEXT);

        // then
        assertThat(result.get("pass")).isEqualTo(false);
        assertThat(result.get("must_include")).isEqualTo("FAIL");
        assertThat((List<String>) result.get("failedChecks")).contains("must_include");
    }
}
