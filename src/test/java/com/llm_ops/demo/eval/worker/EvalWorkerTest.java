package com.llm_ops.demo.eval.worker;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.llm_ops.demo.eval.config.EvalProperties;
import com.llm_ops.demo.eval.domain.EvalMode;
import com.llm_ops.demo.eval.domain.EvalRun;
import com.llm_ops.demo.eval.service.EvalExecutionService;
import com.llm_ops.demo.eval.service.EvalMetrics;
import com.llm_ops.demo.eval.service.EvalRunService;
import java.time.Duration;
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
        EvalMetrics evalMetrics = mock(EvalMetrics.class);
        EvalWorker worker = new EvalWorker(evalRunService, evalExecutionService, evalProperties, evalMetrics);

        EvalRun firstRun = mock(EvalRun.class);
        EvalRun secondRun = mock(EvalRun.class);
        EvalRun thirdRun = mock(EvalRun.class);
        when(firstRun.getId()).thenReturn(1L);
        when(firstRun.mode()).thenReturn(EvalMode.CANDIDATE_ONLY);
        when(secondRun.getId()).thenReturn(2L);
        when(secondRun.mode()).thenReturn(EvalMode.CANDIDATE_ONLY);
        when(thirdRun.getId()).thenReturn(3L);
        when(thirdRun.mode()).thenReturn(EvalMode.CANDIDATE_ONLY);
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

    @Test
    @DisplayName("애플리케이션 시작 시 timeout 기준으로 stuck run 복구를 수행한다")
    void 시작시_stuck_run_복구를_수행한다() {
        // given
        EvalProperties evalProperties = new EvalProperties();
        evalProperties.setRunTimeoutMinutes(45L);

        EvalRunService evalRunService = mock(EvalRunService.class);
        EvalExecutionService evalExecutionService = mock(EvalExecutionService.class);
        EvalMetrics evalMetrics = mock(EvalMetrics.class);
        EvalWorker worker = new EvalWorker(evalRunService, evalExecutionService, evalProperties, evalMetrics);

        when(evalRunService.recoverStuckRuns(Duration.ofMinutes(45L))).thenReturn(2);

        // when
        worker.onStartupRecovery();

        // then
        verify(evalRunService).recoverStuckRuns(Duration.ofMinutes(45L));
    }

    @Test
    @DisplayName("애플리케이션 시작 복구 중 예외가 발생해도 시작은 중단되지 않는다")
    void 시작복구_예외가_발생해도_시작은_중단되지_않는다() {
        // given
        EvalProperties evalProperties = new EvalProperties();
        evalProperties.setRunTimeoutMinutes(30L);

        EvalRunService evalRunService = mock(EvalRunService.class);
        EvalExecutionService evalExecutionService = mock(EvalExecutionService.class);
        EvalMetrics evalMetrics = mock(EvalMetrics.class);
        EvalWorker worker = new EvalWorker(evalRunService, evalExecutionService, evalProperties, evalMetrics);

        doThrow(new RuntimeException("db unavailable"))
                .when(evalRunService)
                .recoverStuckRuns(Duration.ofMinutes(30L));

        // when // then
        assertDoesNotThrow(worker::onStartupRecovery);
        verify(evalRunService).recoverStuckRuns(Duration.ofMinutes(30L));
    }
}
