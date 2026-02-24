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
    @DisplayName("max_chars 룰을 위반하면 실패 항목에 기록된다")
    @SuppressWarnings("unchecked")
    void max_chars_룰_위반시_실패항목에_기록된다() {
        // given
        String output = "환불은 접수 후 처리됩니다.";
        Map<String, Object> constraints = Map.of(
                "max_chars", 5
        );

        // when
        Map<String, Object> result = service.check(output, constraints, null, RubricTemplateCode.GENERAL_TEXT);

        // then
        assertThat(result.get("pass")).isEqualTo(false);
        assertThat(result.get("max_chars")).isEqualTo("FAIL");
        assertThat((List<String>) result.get("failedChecks")).contains("max_chars");
    }

    @Test
    @DisplayName("must_include 룰이 만족되지 않으면 경고 항목에 기록되고 pass는 유지된다")
    @SuppressWarnings("unchecked")
    void must_include_룰이_만족되지_않으면_경고_항목에_기록되고_pass는_유지된다() {
        // given
        String output = "환불은 접수 후 처리됩니다.";
        Map<String, Object> constraints = Map.of(
                "must_include", List.of("영업일", "환불")
        );

        // when
        Map<String, Object> result = service.check(output, constraints, null, RubricTemplateCode.GENERAL_TEXT);

        // then
        assertThat(result.get("pass")).isEqualTo(true);
        assertThat(result.get("must_include")).isEqualTo("WARN");
        assertThat((List<String>) result.get("failedChecks")).doesNotContain("must_include");
        assertThat((List<String>) result.get("warningChecks")).contains("must_include");
    }

    @Test
    @DisplayName("must_not_include 룰을 위반하면 실패 항목에 기록된다")
    @SuppressWarnings("unchecked")
    void must_not_include_룰을_위반하면_실패_항목에_기록된다() {
        // given
        String output = "환불은 확실히 처리됩니다.";
        Map<String, Object> constraints = Map.of(
                "must_not_include", List.of("확실히")
        );

        // when
        Map<String, Object> result = service.check(output, constraints, null, RubricTemplateCode.GENERAL_TEXT);

        // then
        assertThat(result.get("pass")).isEqualTo(false);
        assertThat(result.get("must_not_include")).isEqualTo("FAIL");
        assertThat((List<String>) result.get("failedChecks")).contains("must_not_include");
    }

    @Test
    @DisplayName("키워드 정규화(BASIC)를 사용하면 공백/구두점 차이를 허용한다")
    @SuppressWarnings("unchecked")
    void 키워드_정규화_BASIC를_사용하면_공백_구두점_차이를_허용한다() {
        // given
        String output = "사전신청은 온라인으로 진행됩니다. Refund-policy!!";
        Map<String, Object> constraints = Map.of(
                "keyword_normalization", "BASIC",
                "must_include", List.of("사전 신청", "refund policy")
        );

        // when
        Map<String, Object> result = service.check(output, constraints, null, RubricTemplateCode.GENERAL_TEXT);

        // then
        assertThat(result.get("pass")).isEqualTo(true);
        assertThat(result.get("must_include")).isEqualTo("PASS");
        assertThat((List<String>) result.get("warningChecks")).isEmpty();
    }

    @Test
    @DisplayName("required_keys가 있으면 json_only가 아니어도 schema를 검사한다")
    void required_keys가_있으면_json_only가_아니어도_schema를_검사한다() {
        // given
        String output = "{\"answer\":\"ok\",\"category\":\"refund\"}";
        Map<String, Object> constraints = Map.of(
                "required_keys", List.of("answer", "category")
        );

        // when
        Map<String, Object> result = service.check(output, constraints, null, RubricTemplateCode.GENERAL_TEXT);

        // then
        assertThat(result.get("pass")).isEqualTo(true);
        assertThat(result.get("schema")).isEqualTo("PASS");
    }

    @Test
    @DisplayName("출력이 null이어도 max_chars와 max_lines는 0 기준으로 통과한다")
    @SuppressWarnings("unchecked")
    void 출력이_null이어도_max_chars와_max_lines는_0_기준으로_통과한다() {
        // given
        Map<String, Object> constraints = Map.of(
                "max_chars", 10,
                "max_lines", 2
        );

        // when
        Map<String, Object> result = service.check(null, constraints, null, RubricTemplateCode.GENERAL_TEXT);

        // then
        assertThat(result.get("pass")).isEqualTo(true);
        assertThat(result.get("max_chars")).isEqualTo("PASS");
        assertThat(result.get("max_lines")).isEqualTo("PASS");
        assertThat((List<String>) result.get("failedChecks")).isEmpty();
        assertThat((List<String>) result.get("warningChecks")).isEmpty();
    }
}
