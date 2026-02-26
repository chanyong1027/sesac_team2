package com.llm_ops.demo.eval.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

class EvalCaseResultTest {

    @Test
    @DisplayName("QUEUED 상태로 생성된다")
    void queued_상태로_생성된다() {
        // given
        EvalRun evalRun = mock(EvalRun.class);
        EvalTestCase testCase = mock(EvalTestCase.class);

        // when
        EvalCaseResult result = EvalCaseResult.queue(evalRun, testCase);

        // then
        assertThat(result.status()).isEqualTo(EvalCaseStatus.QUEUED);
        assertThat(result.getEvalRun()).isEqualTo(evalRun);
        assertThat(result.getTestCase()).isEqualTo(testCase);
    }

    @Test
    @DisplayName("RUNNING 상태로 전환하면 startedAt이 설정된다")
    void running_상태_전환시_startedAt_설정() {
        // given
        EvalRun evalRun = mock(EvalRun.class);
        EvalTestCase testCase = mock(EvalTestCase.class);
        EvalCaseResult result = EvalCaseResult.queue(evalRun, testCase);

        // when
        LocalDateTime before = LocalDateTime.now();
        result.markRunning();
        LocalDateTime after = LocalDateTime.now();

        // then
        assertThat(result.status()).isEqualTo(EvalCaseStatus.RUNNING);
        assertThat(result.getStartedAt()).isBetween(before, after);
    }

    @Test
    @DisplayName("OK 상태로 완료하면 모든 결과 데이터가 저장된다")
    void ok_상태_완료시_모든_결과_저장() {
        // given
        EvalRun evalRun = mock(EvalRun.class);
        EvalTestCase testCase = mock(EvalTestCase.class);
        EvalCaseResult result = EvalCaseResult.queue(evalRun, testCase);
        result.markRunning();

        String candidateOutput = "candidate answer";
        String baselineOutput = "baseline answer";
        Map<String, Object> candidateMeta = Map.of("tokens", 100);
        Map<String, Object> baselineMeta = Map.of("tokens", 90);
        Map<String, Object> ruleChecks = Map.of("passed", true);
        Map<String, Object> judgeOutput = Map.of("score", 0.85);
        Double overallScore = 0.85;
        Boolean pass = true;

        // when
        LocalDateTime before = LocalDateTime.now();
        result.markOk(candidateOutput, baselineOutput, candidateMeta, baselineMeta,
                     ruleChecks, judgeOutput, overallScore, pass);
        LocalDateTime after = LocalDateTime.now();

        // then
        assertThat(result.status()).isEqualTo(EvalCaseStatus.OK);
        assertThat(result.getCandidateOutputText()).isEqualTo(candidateOutput);
        assertThat(result.getBaselineOutputText()).isEqualTo(baselineOutput);
        assertThat(result.getCandidateMetaJson()).isEqualTo(candidateMeta);
        assertThat(result.getBaselineMetaJson()).isEqualTo(baselineMeta);
        assertThat(result.getRuleChecksJson()).isEqualTo(ruleChecks);
        assertThat(result.getJudgeOutputJson()).isEqualTo(judgeOutput);
        assertThat(result.getOverallScore()).isEqualTo(overallScore);
        assertThat(result.getPass()).isEqualTo(pass);
        assertThat(result.getErrorCode()).isNull();
        assertThat(result.getErrorMessage()).isNull();
        assertThat(result.getCompletedAt()).isBetween(before, after);
    }

    @Test
    @DisplayName("ERROR 상태로 완료하면 에러 정보가 저장된다")
    void error_상태_완료시_에러_정보_저장() {
        // given
        EvalRun evalRun = mock(EvalRun.class);
        EvalTestCase testCase = mock(EvalTestCase.class);
        EvalCaseResult result = EvalCaseResult.queue(evalRun, testCase);
        result.markRunning();

        String errorCode = "MODEL_ERROR";
        String errorMessage = "Model unavailable";

        // when
        LocalDateTime before = LocalDateTime.now();
        result.markError(errorCode, errorMessage);
        LocalDateTime after = LocalDateTime.now();

        // then
        assertThat(result.status()).isEqualTo(EvalCaseStatus.ERROR);
        assertThat(result.getErrorCode()).isEqualTo(errorCode);
        assertThat(result.getErrorMessage()).isEqualTo(errorMessage);
        assertThat(result.getCompletedAt()).isBetween(before, after);
    }

    @Test
    @DisplayName("effectivePass는 human override가 없으면 pass를 반환한다")
    void effectivePass_override_없으면_pass_반환() {
        // given
        EvalRun evalRun = mock(EvalRun.class);
        EvalTestCase testCase = mock(EvalTestCase.class);
        EvalCaseResult result = EvalCaseResult.queue(evalRun, testCase);
        result.markOk("output", null, null, null, null, null, 0.9, true);

        // when
        Boolean effectivePass = result.effectivePass();

        // then
        assertThat(effectivePass).isTrue();
    }

    @Test
    @DisplayName("effectivePass는 INCORRECT verdict의 human override를 우선한다")
    void effectivePass_incorrect_verdict의_override_우선() {
        // given
        EvalRun evalRun = mock(EvalRun.class);
        EvalTestCase testCase = mock(EvalTestCase.class);
        EvalCaseResult result = EvalCaseResult.queue(evalRun, testCase);
        result.markOk("output", null, null, null, null, null, 0.9, true);

        // when
        result.applyHumanReviewUpdate(EvalHumanReviewVerdict.INCORRECT, false,
                                     "comment", "category", 1L, null);

        // then
        assertThat(result.effectivePass()).isFalse();
        assertThat(result.getPass()).isTrue(); // original pass is unchanged
    }

    @Test
    @DisplayName("INCORRECT verdict는 overridePass 없이 적용할 수 없다")
    void incorrect_verdict는_overridePass_필수() {
        // given
        EvalRun evalRun = mock(EvalRun.class);
        EvalTestCase testCase = mock(EvalTestCase.class);
        EvalCaseResult result = EvalCaseResult.queue(evalRun, testCase);
        result.markOk("output", null, null, null, null, null, 0.9, true);

        // when & then
        assertThatThrownBy(() ->
            result.applyHumanReviewUpdate(EvalHumanReviewVerdict.INCORRECT, null,
                                         "comment", "category", 1L, null)
        ).isInstanceOf(IllegalArgumentException.class)
         .hasMessageContaining("overridePass is required");
    }

    @Test
    @DisplayName("CORRECT verdict는 overridePass 없이 적용 가능하다")
    void correct_verdict는_overridePass_없이_적용_가능() {
        // given
        EvalRun evalRun = mock(EvalRun.class);
        EvalTestCase testCase = mock(EvalTestCase.class);
        EvalCaseResult result = EvalCaseResult.queue(evalRun, testCase);
        result.markOk("output", null, null, null, null, null, 0.9, true);

        // when
        result.applyHumanReviewUpdate(EvalHumanReviewVerdict.CORRECT, null,
                                     "good", "quality", 1L, null);

        // then
        assertThat(result.getHumanReviewVerdict()).isEqualTo(EvalHumanReviewVerdict.CORRECT);
        assertThat(result.effectivePass()).isTrue();
    }
}
