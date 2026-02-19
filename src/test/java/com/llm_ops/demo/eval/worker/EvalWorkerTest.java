package com.llm_ops.demo.eval.worker;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.llm_ops.demo.eval.config.EvalProperties;
import com.llm_ops.demo.eval.domain.EvalRun;
import com.llm_ops.demo.eval.service.EvalExecutionService;
import com.llm_ops.demo.eval.service.EvalRunService;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class EvalWorkerTest {

    @Test
    @DisplayName("배치 내 단일 run 처리 실패가 발생해도 다음 run 처리를 계속한다")
    void 배치_내_단일_run_처리_실패가_발생해도_다음_run_처리를_계속한다() {
        // given
        EvalProperties evalProperties = new EvalProperties();
        evalProperties.getWorker().setBatchSize(3);

        EvalRunService evalRunService = mock(EvalRunService.class);
        EvalExecutionService evalExecutionService = mock(EvalExecutionService.class);
        EvalWorker worker = new EvalWorker(evalRunService, evalExecutionService, evalProperties);

        EvalRun firstRun = mock(EvalRun.class);
        EvalRun secondRun = mock(EvalRun.class);
        EvalRun thirdRun = mock(EvalRun.class);
        when(firstRun.getId()).thenReturn(1L);
        when(secondRun.getId()).thenReturn(2L);
        when(thirdRun.getId()).thenReturn(3L);
        when(evalRunService.pickQueuedRuns(3)).thenReturn(List.of(firstRun, secondRun, thirdRun));
        doThrow(new RuntimeException("boom")).when(evalExecutionService).processRun(2L);

        // when
        worker.pollQueuedRuns();

        // then
        verify(evalRunService).pickQueuedRuns(3);
        verify(evalExecutionService).processRun(1L);
        verify(evalExecutionService).processRun(2L);
        verify(evalExecutionService).processRun(3L);
    }
}
