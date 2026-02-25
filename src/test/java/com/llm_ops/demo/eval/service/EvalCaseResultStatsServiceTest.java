package com.llm_ops.demo.eval.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.eval.domain.EvalCaseStatus;
import com.llm_ops.demo.eval.domain.EvalHumanReviewVerdict;
import com.llm_ops.demo.eval.domain.EvalRun;
import com.llm_ops.demo.eval.dto.EvalCaseResultStatsResponse;
import com.llm_ops.demo.eval.dto.EvalCaseResultTableListResponse;
import com.llm_ops.demo.eval.dto.EvalCaseResultTableRowResponse;
import com.llm_ops.demo.eval.repository.EvalCaseResultRepository;
import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.workspace.domain.Workspace;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

class EvalCaseResultStatsServiceTest {

    private final EvalAccessService evalAccessService = mock(EvalAccessService.class);
    private final EvalCaseResultRepository evalCaseResultRepository = mock(EvalCaseResultRepository.class);
    private final EvalCaseResultStatsService service = new EvalCaseResultStatsService(
            evalAccessService,
            evalCaseResultRepository
    );

    @Test
    @DisplayName("cases:stats는 상태/패스/휴먼리뷰/라벨 통계를 집계한다")
    void cases_stats는_통계를_정상_집계한다() {
        // given
        Long workspaceId = 1L;
        Long promptId = 2L;
        Long runId = 3L;
        Long userId = 4L;

        EvalRun run = mock(EvalRun.class);
        when(run.getId()).thenReturn(runId);
        stubPromptScope(workspaceId, promptId, userId, runId, run);

        List<EvalCaseResultRepository.StatsRowProjection> rows = List.of(
                statsRow("OK", true, EvalHumanReviewVerdict.CORRECT, null, Map.of("labels", List.of("a", "b"))),
                statsRow("OK", false, EvalHumanReviewVerdict.INCORRECT, true, Map.of("labels", List.of("a"))),
                statsRow("RUNNING", null, EvalHumanReviewVerdict.UNREVIEWED, null, Map.of()),
                statsRow("ERROR", null, null, null, Map.of())
        );
        when(evalCaseResultRepository.findCaseStatsRows(runId)).thenReturn(rows);

        // when
        EvalCaseResultStatsResponse stats = service.getCaseStats(workspaceId, promptId, runId, userId);

        // then
        assertThat(stats.okCount()).isEqualTo(2);
        assertThat(stats.runningCount()).isEqualTo(1);
        assertThat(stats.errorCount()).isEqualTo(1);
        assertThat(stats.passTrueCount()).isEqualTo(1);
        assertThat(stats.passFalseCount()).isEqualTo(1);
        assertThat(stats.effectivePassTrueCount()).isEqualTo(2);
        assertThat(stats.effectivePassFalseCount()).isEqualTo(0);
        assertThat(stats.humanCorrectCount()).isEqualTo(1);
        assertThat(stats.humanIncorrectCount()).isEqualTo(1);
        assertThat(stats.humanUnreviewedCount()).isEqualTo(2);
        assertThat(stats.topLabelCounts()).containsEntry("a", 2L).containsEntry("b", 1L);
    }

    @Test
    @DisplayName("cases:table에서 overridden=true이면 reviewVerdict를 INCORRECT로 고정해 조회한다")
    void cases_table_overridden_true_필터를_INCORRECT로_고정한다() {
        // given
        Long workspaceId = 1L;
        Long promptId = 2L;
        Long runId = 3L;
        Long userId = 4L;

        EvalRun run = mock(EvalRun.class);
        when(run.getId()).thenReturn(runId);
        stubPromptScope(workspaceId, promptId, userId, runId, run);

        EvalCaseResultRepository.TableRowProjection row = tableRow(
                11L,
                21L,
                "OK",
                4.1d,
                false,
                EvalHumanReviewVerdict.INCORRECT,
                true,
                Map.of("labels", List.of("format"), "reason", "manual"),
                LocalDateTime.now().minusMinutes(1),
                LocalDateTime.now()
        );
        when(evalCaseResultRepository.findCaseTableRows(
                eq(runId),
                eq("OK"),
                eq(false),
                eq(EvalHumanReviewVerdict.INCORRECT),
                any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of(row)));

        // when
        EvalCaseResultTableListResponse response = service.getCaseTable(
                workspaceId,
                promptId,
                runId,
                userId,
                0,
                20,
                EvalCaseStatus.OK,
                false,
                EvalHumanReviewVerdict.CORRECT,
                true
        );

        // then
        assertThat(response.content()).hasSize(1);
        EvalCaseResultTableRowResponse dto = response.content().get(0);
        assertThat(dto.humanReviewVerdict()).isEqualTo(EvalHumanReviewVerdict.INCORRECT);
        assertThat(dto.effectivePass()).isTrue();
        assertThat(dto.labels()).containsExactly("format");
        assertThat(dto.reason()).isEqualTo("manual");

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(evalCaseResultRepository).findCaseTableRows(
                eq(runId),
                eq("OK"),
                eq(false),
                eq(EvalHumanReviewVerdict.INCORRECT),
                pageableCaptor.capture()
        );
        assertThat(pageableCaptor.getValue().getPageNumber()).isEqualTo(0);
        assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(20);
    }

    private EvalCaseResultRepository.StatsRowProjection statsRow(
            String status,
            Boolean pass,
            EvalHumanReviewVerdict verdict,
            Boolean overridePass,
            Map<String, Object> judgeOutput
    ) {
        return new EvalCaseResultRepository.StatsRowProjection() {
            @Override
            public String getStatus() {
                return status;
            }

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

            @Override
            public Map<String, Object> getJudgeOutputJson() {
                return judgeOutput;
            }
        };
    }

    private EvalCaseResultRepository.TableRowProjection tableRow(
            Long id,
            Long testCaseId,
            String status,
            Double overallScore,
            Boolean pass,
            EvalHumanReviewVerdict verdict,
            Boolean overridePass,
            Map<String, Object> judgeOutput,
            LocalDateTime startedAt,
            LocalDateTime completedAt
    ) {
        return new EvalCaseResultRepository.TableRowProjection() {
            @Override
            public Long getId() {
                return id;
            }

            @Override
            public Long getTestCaseId() {
                return testCaseId;
            }

            @Override
            public String getStatus() {
                return status;
            }

            @Override
            public Double getOverallScore() {
                return overallScore;
            }

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

            @Override
            public Map<String, Object> getJudgeOutputJson() {
                return judgeOutput;
            }

            @Override
            public LocalDateTime getStartedAt() {
                return startedAt;
            }

            @Override
            public LocalDateTime getCompletedAt() {
                return completedAt;
            }
        };
    }

    private void stubPromptScope(Long workspaceId, Long promptId, Long userId, Long runId, EvalRun run) {
        User user = mock(User.class);
        Workspace workspace = mock(Workspace.class);
        Prompt prompt = mock(Prompt.class);
        when(prompt.getId()).thenReturn(promptId);

        EvalAccessService.PromptScope scope = new EvalAccessService.PromptScope(user, workspace, prompt);
        when(evalAccessService.requirePromptScope(workspaceId, promptId, userId)).thenReturn(scope);
        when(evalAccessService.requireRun(prompt, runId)).thenReturn(run);
    }
}
