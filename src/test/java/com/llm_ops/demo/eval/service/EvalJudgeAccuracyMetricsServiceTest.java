package com.llm_ops.demo.eval.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.llm_ops.demo.eval.domain.EvalHumanReviewVerdict;
import com.llm_ops.demo.eval.domain.EvalRun;
import com.llm_ops.demo.eval.dto.EvalJudgeAccuracyMetricsResponse;
import com.llm_ops.demo.eval.dto.EvalJudgeAccuracyRollupResponse;
import com.llm_ops.demo.eval.repository.EvalCaseResultRepository;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class EvalJudgeAccuracyMetricsServiceTest {

    private final EvalAccessService evalAccessService = mock(EvalAccessService.class);
    private final EvalCaseResultRepository evalCaseResultRepository = mock(EvalCaseResultRepository.class);

    private final EvalJudgeAccuracyMetricsService service = new EvalJudgeAccuracyMetricsService(
            evalAccessService,
            evalCaseResultRepository
    );

    @Test
    @DisplayName("검토된 행이 없으면 reviewedCount=0, accuracy=0, overrideRate=0, note가 'metrics computed on reviewed subset'이다")
    void no_reviewed_rows_returns_zero_metrics() {
        // given
        Long workspaceId = 1L;
        Long promptId = 2L;
        Long runId = 3L;
        Long userId = 4L;

        EvalAccessService.PromptScope scope = mock(EvalAccessService.PromptScope.class);
        EvalRun run = mock(EvalRun.class);
        when(run.getId()).thenReturn(runId);

        when(evalAccessService.requirePromptScope(workspaceId, promptId, userId)).thenReturn(scope);
        when(evalAccessService.requireRun(any(), anyLong())).thenReturn(run);
        when(evalCaseResultRepository.findJudgeAccuracyRowsByRunId(runId))
                .thenReturn(List.of());

        // when
        EvalJudgeAccuracyMetricsResponse result = service.getRunMetrics(workspaceId, promptId, runId, userId);

        // then
        assertThat(result.reviewedCount()).isEqualTo(0L);
        assertThat(result.correctCount()).isEqualTo(0L);
        assertThat(result.incorrectCount()).isEqualTo(0L);
        assertThat(result.accuracy()).isEqualTo(0.0d);
        assertThat(result.overrideRate()).isEqualTo(0.0d);
        assertThat(result.note()).isEqualTo("metrics computed on reviewed subset");
        assertThat(result.confusionMatrix().tp()).isEqualTo(0L);
        assertThat(result.confusionMatrix().tn()).isEqualTo(0L);
        assertThat(result.confusionMatrix().fp()).isEqualTo(0L);
        assertThat(result.confusionMatrix().fn()).isEqualTo(0L);
    }

    @Test
    @DisplayName("혼합된 검토 행들로 TP/TN/FP/FN 및 precision/recall/f1/balancedAccuracy를 계산한다")
    void mixed_reviewed_rows_computes_confusion_matrix() {
        // given
        Long workspaceId = 1L;
        Long promptId = 2L;
        Long runId = 3L;
        Long userId = 4L;

        EvalAccessService.PromptScope scope = mock(EvalAccessService.PromptScope.class);
        EvalRun run = mock(EvalRun.class);
        when(run.getId()).thenReturn(runId);

        when(evalAccessService.requirePromptScope(workspaceId, promptId, userId)).thenReturn(scope);
        when(evalAccessService.requireRun(any(), anyLong())).thenReturn(run);

        // Rows to create confusion matrix:
        // TP (2): predicted=true, truth=true
        //   - Row A: pass=true, verdict=CORRECT (truth=pass=true)
        //   - Row B: pass=true, verdict=INCORRECT, override=true (truth=override=true)
        // TN (2): predicted=false, truth=false
        //   - Row C: pass=false, verdict=CORRECT (truth=pass=false)
        //   - Row D: pass=false, verdict=INCORRECT, override=false (truth=override=false)
        // FP (1): predicted=true, truth=false
        //   - Row E: pass=false, verdict=CORRECT (truth=pass=false)
        // FN (1): predicted=false, truth=true
        //   - Row F: pass=true, verdict=CORRECT (truth=pass=true)
        // Skipped: verdict=UNREVIEWED
        List<EvalCaseResultRepository.JudgeAccuracyRowProjection> rows = List.of(
                createRow(true, EvalHumanReviewVerdict.CORRECT, null),
                createRow(true, EvalHumanReviewVerdict.INCORRECT, true),
                createRow(false, EvalHumanReviewVerdict.CORRECT, null),
                createRow(false, EvalHumanReviewVerdict.INCORRECT, false),
                createRow(true, EvalHumanReviewVerdict.INCORRECT, false),  // FP: pred=true, override=false -> truth=false
                createRow(false, EvalHumanReviewVerdict.INCORRECT, true),   // FN: pred=false, override=true -> truth=true
                createRow(true, EvalHumanReviewVerdict.UNREVIEWED, null)
        );

        when(evalCaseResultRepository.findJudgeAccuracyRowsByRunId(runId)).thenReturn(rows);
        // when
        EvalJudgeAccuracyMetricsResponse result = service.getRunMetrics(workspaceId, promptId, runId, userId);
        assertThat(result.reviewedCount()).isEqualTo(6L);
        assertThat(result.correctCount()).isEqualTo(2L);
        assertThat(result.incorrectCount()).isEqualTo(4L);
        EvalJudgeAccuracyMetricsResponse.ConfusionMatrix cm = result.confusionMatrix();
        assertThat(cm.tp()).isEqualTo(2L);
        assertThat(cm.tn()).isEqualTo(2L);
        assertThat(cm.fp()).isEqualTo(1L);
        assertThat(cm.fn()).isEqualTo(1L);
        assertThat(cm.precision()).isEqualTo(2.0d / 3.0d);
        assertThat(cm.recall()).isEqualTo(2.0d / 3.0d);
        assertThat(cm.f1()).isEqualTo(2.0d / 3.0d);
        assertThat(cm.balancedAccuracy()).isEqualTo(2.0d / 3.0d);
    }

    @Test
    @DisplayName("getPromptRollup은 requirePromptScope를 호출하고 run 검증 없이 저장소에서 행을 가져온다")
    void getPromptRollup_calls_requirePromptScope_without_run_check() {
        // given
        Long workspaceId = 1L;
        Long promptId = 2L;
        Long userId = 3L;
        LocalDateTime from = LocalDateTime.of(2024, 1, 1, 0, 0);
        LocalDateTime to = LocalDateTime.of(2024, 12, 31, 23, 59);
        Long promptVersionId = null;

        EvalAccessService.PromptScope scope = mock(EvalAccessService.PromptScope.class);
        when(evalAccessService.requirePromptScope(workspaceId, promptId, userId)).thenReturn(scope);
        when(evalCaseResultRepository.findJudgeAccuracyRowsForPrompt(workspaceId, promptId, promptVersionId, from, to))
                .thenReturn(List.of());

        // when
        EvalJudgeAccuracyRollupResponse result = service.getPromptRollup(workspaceId, promptId, userId, from, to, promptVersionId);

        // then
        assertThat(result.promptId()).isEqualTo(promptId);
        assertThat(result.promptVersionId()).isNull();
        assertThat(result.from()).isEqualTo(from);
        assertThat(result.to()).isEqualTo(to);
        assertThat(result.metrics().reviewedCount()).isEqualTo(0L);
    }

    private EvalCaseResultRepository.JudgeAccuracyRowProjection createRow(
            Boolean pass,
            EvalHumanReviewVerdict verdict,
            Boolean overridePass
    ) {
        return new EvalCaseResultRepository.JudgeAccuracyRowProjection() {
            @Override
            public Boolean getPass() {
                return pass;
            }

            @Override
            public EvalHumanReviewVerdict getHumanReviewVerdict() {
                return verdict;
            }

            @Override
            public Boolean getHumanOverridePass() {
                return overridePass;
            }
        };
    }
}
