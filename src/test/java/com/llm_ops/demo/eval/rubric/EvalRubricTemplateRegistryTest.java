package com.llm_ops.demo.eval.rubric;

import static org.assertj.core.api.Assertions.assertThat;

import com.llm_ops.demo.eval.domain.RubricTemplateCode;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class EvalRubricTemplateRegistryTest {

    private final EvalRubricTemplateRegistry registry = new EvalRubricTemplateRegistry();

    @Test
    @DisplayName("CUSTOM 루브릭은 기본 가중치와 게이트를 제공한다")
    void CUSTOM_루브릭은_기본_가중치와_게이트를_제공한다() {
        // given
        Map<String, Object> overrides = null;

        // when
        ResolvedRubricConfig config = registry.resolve(RubricTemplateCode.CUSTOM, overrides);

        // then
        assertThat(config.templateCode()).isEqualTo("CUSTOM");
        assertThat(config.weights()).containsEntry("quality", 1.0);
        assertThat(config.gates()).containsEntry("minOverallScore", 70.0);
    }

    @Test
    @DisplayName("CUSTOM 루브릭 오버라이드로 설명과 가중치를 교체할 수 있다")
    void CUSTOM_루브릭_오버라이드로_설명과_가중치를_교체할_수_있다() {
        // given
        Map<String, Object> overrides = Map.of(
                "description", "학부모 안내 메시지 평가",
                "weights", Map.of(
                        "정확성", 1.4,
                        "친절성", 1.1
                ),
                "gates", Map.of("minOverallScore", 78.0)
        );

        // when
        ResolvedRubricConfig config = registry.resolve(RubricTemplateCode.CUSTOM, overrides);

        // then
        assertThat(config.description()).isEqualTo("학부모 안내 메시지 평가");
        assertThat(config.weights()).containsEntry("정확성", 1.4).containsEntry("친절성", 1.1);
        assertThat(config.gates()).containsEntry("minOverallScore", 78.0);
    }
}
