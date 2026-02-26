package com.llm_ops.demo.eval.domain;

import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import java.time.LocalDateTime;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class EvalRunTest {

    @Test
    @DisplayName("markRunning은 QUEUED 상태를 RUNNING으로 전환한다")
    void markRunning은_queued를_running으로_전환한다() {
        // given
        EvalRun run = createQueuedRun();

        // when
        run.markRunning();

        // then
        assertThat(run.status()).isEqualTo(EvalRunStatus.RUNNING);
        assertThat(run.getStartedAt()).isNotNull();
    }

    @Test
    @DisplayName("markCancelled은 QUEUED 상태를 CANCELLED로 전환한다")
    void markCancelled은_queued를_cancelled로_전환한다() {
        // given
        EvalRun run = createQueuedRun();

        // when
        run.markCancelled();

        // then
        assertThat(run.status()).isEqualTo(EvalRunStatus.CANCELLED);
        assertThat(run.getCompletedAt()).isNotNull();
    }

    @Test
    @DisplayName("markCancelled은 RUNNING 상태를 CANCELLED로 전환한다")
    void markCancelled은_running을_cancelled로_전환한다() {
        // given
        EvalRun run = createQueuedRun();
        run.markRunning();

        // when
        run.markCancelled();

        // then
        assertThat(run.status()).isEqualTo(EvalRunStatus.CANCELLED);
        assertThat(run.getCompletedAt()).isNotNull();
    }

    @Test
    @DisplayName("onCaseOk(true)는 처리/성공 카운트를 증가시킨다")
    void onCaseOk_true는_처리와_성공을_증가시킨다() {
        // given
        EvalRun run = createQueuedRun();

        // when
        run.onCaseOk(true);

        // then
        assertThat(run.getProcessedCases()).isEqualTo(1);
        assertThat(run.getPassedCases()).isEqualTo(1);
        assertThat(run.getFailedCases()).isEqualTo(0);
        assertThat(run.getErrorCases()).isEqualTo(0);
    }

    @Test
    @DisplayName("onCaseOk(false)는 처리/실패 카운트를 증가시킨다")
    void onCaseOk_false는_처리와_실패를_증가시킨다() {
        // given
        EvalRun run = createQueuedRun();

        // when
        run.onCaseOk(false);

        // then
        assertThat(run.getProcessedCases()).isEqualTo(1);
        assertThat(run.getPassedCases()).isEqualTo(0);
        assertThat(run.getFailedCases()).isEqualTo(1);
        assertThat(run.getErrorCases()).isEqualTo(0);
    }

    @Test
    @DisplayName("onCaseError는 처리/에러 카운트를 증가시킨다")
    void onCaseError는_처리와_에러를_증가시킨다() {
        // given
        EvalRun run = createQueuedRun();

        // when
        run.onCaseError();

        // then
        assertThat(run.getProcessedCases()).isEqualTo(1);
        assertThat(run.getPassedCases()).isEqualTo(0);
        assertThat(run.getFailedCases()).isEqualTo(0);
        assertThat(run.getErrorCases()).isEqualTo(1);
    }

    @Test
    @DisplayName("finish는 COMPLETED 상태와 결과 요약을 저장한다")
    void finish는_completed_상태와_요약을_저장한다() {
        // given
        EvalRun run = createQueuedRun();
        Map<String, Object> summary = Map.of("score", 0.9);
        Map<String, Object> cost = Map.of("usd", 0.01);
        LocalDateTime before = LocalDateTime.now();

        // when
        run.finish(summary, cost);

        // then
        assertThat(run.status()).isEqualTo(EvalRunStatus.COMPLETED);
        assertThat(run.getSummaryJson()).isEqualTo(summary);
        assertThat(run.getCostJson()).isEqualTo(cost);
        assertThat(run.getCompletedAt()).isAfterOrEqualTo(before);
    }

    @Test
    @DisplayName("fail은 FAILED 상태와 결과 요약을 저장한다")
    void fail은_failed_상태와_요약을_저장한다() {
        // given
        EvalRun run = createQueuedRun();
        Map<String, Object> summary = Map.of("reason", "provider error");
        Map<String, Object> cost = Map.of("usd", 0.02);
        LocalDateTime before = LocalDateTime.now();

        // when
        run.fail(summary, cost);

        // then
        assertThat(run.status()).isEqualTo(EvalRunStatus.FAILED);
        assertThat(run.getSummaryJson()).isEqualTo(summary);
        assertThat(run.getCostJson()).isEqualTo(cost);
        assertThat(run.getCompletedAt()).isAfterOrEqualTo(before);
    }

    private static EvalRun createQueuedRun() {
        return EvalRun.queue(
                mock(Prompt.class),
                mock(PromptVersion.class),
                mock(EvalDataset.class),
                1L,
                EvalMode.CANDIDATE_ONLY,
                EvalTriggerType.MANUAL,
                RubricTemplateCode.GENERAL_TEXT,
                Map.of(),
                "OPENAI",
                "gpt-4.1-mini",
                "OPENAI",
                "gpt-4.1-mini",
                10,
                1L
        );
    }
}
