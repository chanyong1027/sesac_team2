package com.llm_ops.demo.eval.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.llm_ops.demo.eval.domain.EvalMode;
import com.llm_ops.demo.eval.domain.EvalReleaseCriteria;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class EvalReleaseDecisionCalculatorTest {

    private final EvalReleaseDecisionCalculator calculator = new EvalReleaseDecisionCalculator();

    @Test
    @DisplayName("후보 점수가 배포 대비 하락하면 HOLD로 판정한다")
    void 후보_점수가_배포_대비_하락하면_hold로_판정한다() {
        // given
        EvalReleaseCriteria criteria = EvalReleaseCriteria.createDefault(1L);

        // when
        EvalReleaseDecision decision = calculator.calculate(
                EvalMode.COMPARE_ACTIVE,
                criteria,
                98.0,
                92.0,
                0.0,
                -1.5,
                true
        );

        // then
        assertThat(decision.releaseDecision()).isEqualTo(EvalReleaseDecision.HOLD);
        assertThat(decision.reasons()).contains("COMPARE_REGRESSION_DETECTED");
        assertThat(decision.riskLevel()).isEqualTo("HIGH");
        assertThat(decision.decisionBasis()).isEqualTo(EvalReleaseDecision.BASIS_RUN_SNAPSHOT);
    }

    @Test
    @DisplayName("비교 점수는 상승했지만 개선폭이 작으면 SAFE와 경고를 함께 반환한다")
    void 비교_점수는_상승했지만_개선폭이_작으면_safe와_경고를_함께_반환한다() {
        // given
        EvalReleaseCriteria criteria = EvalReleaseCriteria.createDefault(1L);

        // when
        EvalReleaseDecision decision = calculator.calculate(
                EvalMode.COMPARE_ACTIVE,
                criteria,
                99.0,
                93.0,
                0.0,
                1.0,
                true
        );

        // then
        assertThat(decision.releaseDecision()).isEqualTo(EvalReleaseDecision.SAFE_TO_DEPLOY);
        assertThat(decision.reasons()).contains("COMPARE_IMPROVEMENT_MINOR");
        assertThat(decision.riskLevel()).isEqualTo("MEDIUM");
    }

    @Test
    @DisplayName("Compare 모드에서 운영 비교 데이터가 불완전하면 HOLD로 판정한다")
    void Compare_모드에서_운영_비교_데이터가_불완전하면_hold로_판정한다() {
        // given
        EvalReleaseCriteria criteria = EvalReleaseCriteria.createDefault(1L);

        // when
        EvalReleaseDecision decision = calculator.calculate(
                EvalMode.COMPARE_ACTIVE,
                criteria,
                99.0,
                93.0,
                0.0,
                1.0,
                false
        );

        // then
        assertThat(decision.releaseDecision()).isEqualTo(EvalReleaseDecision.HOLD);
        assertThat(decision.reasons()).contains("COMPARE_BASELINE_INCOMPLETE");
        assertThat(decision.riskLevel()).isEqualTo("HIGH");
    }

    @Test
    @DisplayName("Pass Rate가 기준보다 낮으면 HOLD로 판정한다")
    void pass_rate가_기준보다_낮으면_hold로_판정한다() {
        // given
        EvalReleaseCriteria criteria = EvalReleaseCriteria.createDefault(1L);

        // when
        EvalReleaseDecision decision = calculator.calculate(
                EvalMode.CANDIDATE_ONLY,
                criteria,
                75.0,
                90.0,
                0.0,
                null,
                true
        );

        // then
        assertThat(decision.releaseDecision()).isEqualTo(EvalReleaseDecision.HOLD);
        assertThat(decision.reasons()).contains("PASS_RATE_BELOW_THRESHOLD");
        assertThat(decision.riskLevel()).isEqualTo("MEDIUM");
    }
}
