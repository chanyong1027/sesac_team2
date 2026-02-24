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
    @DisplayName("검토된 행이 없으면 reviewedCount=0, 핵심 비율은 null, note는 reviewed subset 메시지다")
    void no_reviewed_rows_returns_null_metrics() {
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
        when(evalCaseResultRepository.findJudgeAccuracyRowsByRunId(runId)).thenReturn(List.of());

        // when
        EvalJudgeAccuracyMetricsResponse result = service.getRunMetrics(workspaceId, promptId, runId, userId);

        // then
        assertThat(result.runId()).isEqualTo(runId);
        assertThat(result.totalCases()).isEqualTo(0L);
        assertThat(result.reviewedCount()).isEqualTo(0L);
        assertThat(result.correctCount()).isEqualTo(0L);
        assertThat(result.incorrectCount()).isEqualTo(0L);
        assertThat(result.accuracy()).isNull();
        assertThat(result.overrideRate()).isNull();
        assertThat(result.precision()).isNull();
        assertThat(result.recall()).isNull();
        assertThat(result.f1()).isNull();
        assertThat(result.specificity()).isNull();
        assertThat(result.balancedAccuracy()).isNull();
        assertThat(result.note()).isEqualTo("metrics computed on reviewed subset");
        assertThat(result.tp()).isEqualTo(0L);
        assertThat(result.tn()).isEqualTo(0L);
        assertThat(result.fp()).isEqualTo(0L);
        assertThat(result.fn()).isEqualTo(0L);
    }

    @Test
    @DisplayName("혼합된 검토 행으로 TP/TN/FP/FN과 precision/recall/f1/balancedAccuracy를 계산한다")
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

        // Rows:
        // TP (2): (true, CORRECT), (true, INCORRECT, override=true)
        // TN (2): (false, CORRECT), (false, INCORRECT, override=false)
        // FP (1): (true, INCORRECT, override=false)
        // FN (1): (false, INCORRECT, override=true)
        // EXCLUDED FROM CM: (true, INCORRECT, override=null)
        // SKIPPED: (true, UNREVIEWED)
        List<EvalCaseResultRepository.JudgeAccuracyRowProjection> rows = List.of(
                createRow(true, EvalHumanReviewVerdict.CORRECT, null),
                createRow(true, EvalHumanReviewVerdict.INCORRECT, true),
                createRow(false, EvalHumanReviewVerdict.CORRECT, null),
                createRow(false, EvalHumanReviewVerdict.INCORRECT, false),
                createRow(true, EvalHumanReviewVerdict.INCORRECT, false),
                createRow(false, EvalHumanReviewVerdict.INCORRECT, true),
                createRow(true, EvalHumanReviewVerdict.INCORRECT, null),
                createRow(true, EvalHumanReviewVerdict.UNREVIEWED, null)
        );

        when(evalCaseResultRepository.findJudgeAccuracyRowsByRunId(runId)).thenReturn(rows);

        // when
        EvalJudgeAccuracyMetricsResponse result = service.getRunMetrics(workspaceId, promptId, runId, userId);

        // then
        assertThat(result.runId()).isEqualTo(runId);
        assertThat(result.totalCases()).isEqualTo(8L);
        assertThat(result.reviewedCount()).isEqualTo(7L);
        assertThat(result.correctCount()).isEqualTo(2L);
        assertThat(result.incorrectCount()).isEqualTo(5L);

        assertThat(result.tp()).isEqualTo(2L);
        assertThat(result.tn()).isEqualTo(2L);
        assertThat(result.fp()).isEqualTo(1L);
        assertThat(result.fn()).isEqualTo(1L);
        assertThat(result.precision()).isEqualTo(2.0d / 3.0d);
        assertThat(result.recall()).isEqualTo(2.0d / 3.0d);
        assertThat(result.f1()).isEqualTo(2.0d / 3.0d);
        assertThat(result.specificity()).isEqualTo(2.0d / 3.0d);
        assertThat(result.balancedAccuracy()).isEqualTo(2.0d / 3.0d);
    }

    @Test
    @DisplayName("getPromptRollup은 프롬프트 범위 검증 후 평탄화된 롤업 메트릭을 반환한다")
    void get_prompt_rollup_returns_flattened_metrics() {
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
        assertThat(result.totalCases()).isEqualTo(0L);
        assertThat(result.reviewedCount()).isEqualTo(0L);
        assertThat(result.accuracy()).isNull();
        assertThat(result.overrideRate()).isNull();
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
