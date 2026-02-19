package com.llm_ops.demo.eval.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.llm_ops.demo.eval.config.EvalProperties;
import com.llm_ops.demo.eval.domain.EvalDataset;
import com.llm_ops.demo.eval.domain.EvalMode;
import com.llm_ops.demo.eval.domain.EvalRun;
import com.llm_ops.demo.eval.domain.EvalRunStatus;
import com.llm_ops.demo.eval.domain.EvalTriggerType;
import com.llm_ops.demo.eval.domain.RubricTemplateCode;
import com.llm_ops.demo.eval.repository.EvalCaseResultRepository;
import com.llm_ops.demo.eval.repository.EvalRunRepository;
import com.llm_ops.demo.eval.repository.EvalTestCaseRepository;
import com.llm_ops.demo.eval.repository.PromptEvalDefaultRepository;
import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import com.llm_ops.demo.prompt.repository.PromptReleaseRepository;
import com.llm_ops.demo.prompt.repository.PromptRepository;
import com.llm_ops.demo.prompt.repository.PromptVersionRepository;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Pageable;

class EvalRunServiceTest {

    @Test
    @DisplayName("pickQueuedRuns는 조회한 QUEUED run을 RUNNING으로 선점한다")
    void pickQueuedRuns는_조회한_queued_run을_running으로_선점한다() {
        // given
        EvalRunRepository evalRunRepository = mock(EvalRunRepository.class);
        EvalRunService service = new EvalRunService(
                mock(EvalAccessService.class),
                new EvalProperties(),
                evalRunRepository,
                mock(EvalCaseResultRepository.class),
                mock(EvalTestCaseRepository.class),
                mock(PromptEvalDefaultRepository.class),
                mock(PromptReleaseRepository.class),
                mock(PromptRepository.class),
                mock(PromptVersionRepository.class)
        );

        EvalRun queuedRun = EvalRun.queue(
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

        when(evalRunRepository.findQueuedRunsForUpdate(eq(EvalRunStatus.QUEUED.name()), any(Pageable.class)))
                .thenReturn(List.of(queuedRun));
        when(evalRunRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        // when
        List<EvalRun> picked = service.pickQueuedRuns(3);

        // then
        assertThat(picked).hasSize(1);
        assertThat(picked.get(0).status()).isEqualTo(EvalRunStatus.RUNNING);
        verify(evalRunRepository).saveAll(picked);

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(evalRunRepository).findQueuedRunsForUpdate(eq(EvalRunStatus.QUEUED.name()), pageableCaptor.capture());
        assertThat(pageableCaptor.getValue().getPageNumber()).isEqualTo(0);
        assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(3);
    }
}
