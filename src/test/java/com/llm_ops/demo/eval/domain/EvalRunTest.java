package com.llm_ops.demo.eval.domain;

import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class EvalRunTest {

    @Test
    @DisplayName("RUNNING 상태에서 timeoutAt이 없으면 timeoutAt을 보정한다")
    void running_상태에서_timeoutAt이_없으면_보정한다() {
        // given
        EvalRun run = EvalRun.queue(
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
                1,
                1L
        );
        run.markRunning();
        assertThat(run.getTimeoutAt()).isNull();

        // when
        boolean updated = run.ensureTimeoutIfMissing(Duration.ofMinutes(30));

        // then
        assertThat(updated).isTrue();
        assertThat(run.getTimeoutAt()).isNotNull();
        assertThat(run.getTimeoutAt()).isAfterOrEqualTo(run.getStartedAt());
    }

    @Test
    @DisplayName("markRunningWithTimeout은 QUEUED 상태에서 RUNNING으로 전환하고 timeout을 설정한다")
    void markRunningWithTimeout은_queued에서_running으로_전환() {
        // given
        EvalRun run = EvalRun.queue(
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
                1,
                1L
        );

        // when
        run.markRunningWithTimeout(Duration.ofMinutes(30));

        // then
        assertThat(run.status()).isEqualTo(EvalRunStatus.RUNNING);
        assertThat(run.getStartedAt()).isNotNull();
        assertThat(run.getTimeoutAt()).isNotNull();
        assertThat(run.getTimeoutAt()).isAfter(run.getStartedAt());
    }

    @Test
    @DisplayName("isTimedOut은 timeoutAt이 없으면 false를 반환한다")
    void isTimedOut은_timeoutAt_없으면_false() {
        // given
        EvalRun run = EvalRun.queue(
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
                1,
                1L
        );
        run.markRunning();

        // when & then
        assertThat(run.isTimedOut()).isFalse();
    }

    @Test
    @DisplayName("isTimedOut은 timeoutAt이 미래이면 false를 반환한다")
    void isTimedOut은_timeoutAt_미래이면_false() {
        // given
        EvalRun run = EvalRun.queue(
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
                1,
                1L
        );
        run.markRunningWithTimeout(Duration.ofMinutes(30));

        // when & then
        assertThat(run.isTimedOut()).isFalse();
    }

    @Test
    @DisplayName("isTimedOut은 timeoutAt이 과거이면 true를 반환한다")
    void isTimedOut은_timeoutAt_과거이면_true() {
        // given
        EvalRun run = EvalRun.queue(
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
                1,
                1L
        );
        run.markRunningWithTimeout(Duration.ofMinutes(-1));

        // when & then
        assertThat(run.isTimedOut()).isTrue();
    }

    @Test
    @DisplayName("fail은 FAILED 상태로 전환하고 실패 정보를 저장한다")
    void fail은_failed_상태로_전환하고_실패정보_저장() {
        // given
        EvalRun run = EvalRun.queue(
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
                1,
                1L
        );
        run.markRunningWithTimeout(Duration.ofMinutes(30));

        // when
        LocalDateTime before = LocalDateTime.now();
        run.fail("RUN_TIMEOUT", "실행 시간 초과 (30분)");
        LocalDateTime after = LocalDateTime.now();

        // then
        assertThat(run.status()).isEqualTo(EvalRunStatus.FAILED);
        assertThat(run.getFailReasonCode()).isEqualTo("RUN_TIMEOUT");
        assertThat(run.getFailReason()).isEqualTo("실행 시간 초과 (30분)");
        assertThat(run.getCompletedAt()).isBetween(before, after);
    }

    @Test
    @DisplayName("resetToQueued는 RUNNING run을 QUEUED로 리셋한다")
    void resetToQueued는_running을_queued로_리셋() {
        // given
        EvalRun run = EvalRun.queue(
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
                1,
                1L
        );
        run.markRunningWithTimeout(Duration.ofMinutes(30));

        // when
        run.resetToQueued();

        // then
        assertThat(run.status()).isEqualTo(EvalRunStatus.QUEUED);
        assertThat(run.getStartedAt()).isNull();
        assertThat(run.getTimeoutAt()).isNull();
    }

    @Test
    @DisplayName("ensureTimeoutIfMissing은 RUNNING이 아니면 false를 반환한다")
    void ensureTimeoutIfMissing은_running_아니면_false() {
        // given
        EvalRun run = EvalRun.queue(
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
                1,
                1L
        );

        // when
        boolean updated = run.ensureTimeoutIfMissing(Duration.ofMinutes(30));

        // then
        assertThat(updated).isFalse();
    }

    @Test
    @DisplayName("ensureTimeoutIfMissing은 timeoutAt이 이미 있으면 false를 반환한다")
    void ensureTimeoutIfMissing은_timeoutAt_있으면_false() {
        // given
        EvalRun run = EvalRun.queue(
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
                1,
                1L
        );
        run.markRunningWithTimeout(Duration.ofMinutes(30));

        // when
        boolean updated = run.ensureTimeoutIfMissing(Duration.ofMinutes(30));

        // then
        assertThat(updated).isFalse();
    }
}