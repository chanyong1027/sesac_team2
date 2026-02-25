package com.llm_ops.demo.eval.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.llm_ops.demo.eval.config.EvalProperties;
import com.llm_ops.demo.eval.domain.EvalDataset;
import com.llm_ops.demo.eval.domain.EvalMode;
import com.llm_ops.demo.eval.domain.EvalRun;
import com.llm_ops.demo.eval.domain.EvalRunStatus;
import com.llm_ops.demo.eval.domain.EvalTriggerType;
import com.llm_ops.demo.eval.domain.RubricTemplateCode;
import com.llm_ops.demo.eval.repository.EvalCaseResultRepository;
import com.llm_ops.demo.eval.repository.EvalRunRepository;
import com.llm_ops.demo.eval.rubric.EvalRubricTemplateRegistry;
import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import com.llm_ops.demo.prompt.repository.PromptReleaseRepository;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class EvalExecutionServiceTest {

    @Test
    @DisplayName("실행 시작 시 timeout 초과 run은 RUN_TIMEOUT으로 즉시 FAILED 처리된다")
    void 시작시_timeout_초과_run은_즉시_failed_처리된다() {
        // given
        EvalRunRepository evalRunRepository = mock(EvalRunRepository.class);
        EvalCaseResultRepository evalCaseResultRepository = mock(EvalCaseResultRepository.class);
        EvalProperties evalProperties = new EvalProperties();
        evalProperties.setRunTimeoutMinutes(30L);

        EvalExecutionService service = new EvalExecutionService(
                evalRunRepository,
                evalCaseResultRepository,
                mock(PromptReleaseRepository.class),
                mock(EvalModelRunnerService.class),
                mock(com.llm_ops.demo.eval.rule.EvalRuleCheckerService.class),
                mock(EvalRubricTemplateRegistry.class),
                mock(EvalPerformanceSummaryCalculator.class),
                mock(EvalJudgeService.class),
                mock(EvalReleaseCriteriaService.class),
                mock(EvalReleaseDecisionCalculator.class),
                new ObjectMapper(),
                evalProperties,
                mock(EvalMetrics.class)
        );

        EvalRun timedOutRun = EvalRun.queue(
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
        timedOutRun.markRunningWithTimeout(Duration.ofMinutes(-1));
        when(evalRunRepository.findById(1L)).thenReturn(Optional.of(timedOutRun));

        // when
        service.processRun(1L);

        // then
        assertThat(timedOutRun.status()).isEqualTo(EvalRunStatus.FAILED);
        assertThat(timedOutRun.getFailReasonCode()).isEqualTo("RUN_TIMEOUT");
        verify(evalRunRepository).save(timedOutRun);
        verifyNoInteractions(evalCaseResultRepository);
    }
}
