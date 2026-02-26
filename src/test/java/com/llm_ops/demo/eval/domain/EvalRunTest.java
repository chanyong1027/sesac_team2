package com.llm_ops.demo.eval.domain;

import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import java.time.Duration;
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
}
