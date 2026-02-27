package com.llm_ops.demo.eval.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.llm_ops.demo.eval.config.EvalProperties;
import com.llm_ops.demo.eval.domain.EvalCaseResult;
import com.llm_ops.demo.eval.domain.EvalCaseStatus;
import com.llm_ops.demo.eval.domain.EvalDataset;
import com.llm_ops.demo.eval.domain.EvalMode;
import com.llm_ops.demo.eval.domain.EvalRun;
import com.llm_ops.demo.eval.domain.EvalRunStatus;
import com.llm_ops.demo.eval.domain.EvalTestCase;
import com.llm_ops.demo.eval.domain.EvalTriggerType;
import com.llm_ops.demo.eval.domain.RubricTemplateCode;
import com.llm_ops.demo.eval.dto.EvalRunCreateRequest;
import com.llm_ops.demo.eval.dto.EvalRunEstimateRequest;
import com.llm_ops.demo.eval.repository.EvalCaseResultRepository;
import com.llm_ops.demo.eval.repository.EvalRunRepository;
import com.llm_ops.demo.eval.repository.EvalTestCaseRepository;
import com.llm_ops.demo.eval.repository.PromptEvalDefaultRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.prompt.domain.PromptRelease;
import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import com.llm_ops.demo.prompt.repository.PromptReleaseRepository;
import com.llm_ops.demo.prompt.repository.PromptRepository;
import com.llm_ops.demo.prompt.repository.PromptVersionRepository;
import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.workspace.domain.Workspace;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Pageable;

class EvalRunServiceTest {

    @Test
    @DisplayName("estimateRun은 contextJson.question이 비어도 input 값을 question으로 사용한다")
    void estimateRun은_contextJson_question이_비어도_input을_question으로_사용한다() {
        // given
        EvalAccessService evalAccessService = mock(EvalAccessService.class);
        EvalRunRepository evalRunRepository = mock(EvalRunRepository.class);
        EvalCaseResultRepository evalCaseResultRepository = mock(EvalCaseResultRepository.class);
        EvalTestCaseRepository evalTestCaseRepository = mock(EvalTestCaseRepository.class);
        PromptReleaseRepository promptReleaseRepository = mock(PromptReleaseRepository.class);

        EvalRunService service = new EvalRunService(
                evalAccessService,
                new EvalProperties(),
                evalRunRepository,
                evalCaseResultRepository,
                evalTestCaseRepository,
                mock(PromptEvalDefaultRepository.class),
                promptReleaseRepository,
                mock(PromptRepository.class),
                mock(PromptVersionRepository.class)
        );

        Prompt prompt = mock(Prompt.class);
        when(prompt.getId()).thenReturn(100L);
        Workspace workspace = mock(Workspace.class);
        when(workspace.getId()).thenReturn(10L);
        User user = mock(User.class);
        when(user.getId()).thenReturn(1L);

        EvalAccessService.PromptScope scope = new EvalAccessService.PromptScope(user, workspace, prompt);
        when(evalAccessService.requirePromptScope(10L, 100L, 1L)).thenReturn(scope);

        PromptVersion candidateVersion = mock(PromptVersion.class);
        when(candidateVersion.getId()).thenReturn(200L);
        when(candidateVersion.getVersionNo()).thenReturn(4);
        when(candidateVersion.getUserTemplate()).thenReturn("질문: {{question}}");
        when(candidateVersion.getSystemPrompt()).thenReturn(null);
        when(candidateVersion.getProvider()).thenReturn(ProviderType.OPENAI);
        when(candidateVersion.getModel()).thenReturn("gpt-4.1-mini");
        when(candidateVersion.getModelConfig()).thenReturn(null);
        when(evalAccessService.requirePromptVersion(prompt, 200L)).thenReturn(candidateVersion);

        EvalDataset dataset = mock(EvalDataset.class);
        when(dataset.getId()).thenReturn(300L);
        when(evalAccessService.requireDataset(10L, 300L)).thenReturn(dataset);

        EvalTestCase caseRow = mock(EvalTestCase.class);
        when(caseRow.getCaseOrder()).thenReturn(1);
        when(caseRow.getExternalId()).thenReturn("case-question-override");
        when(caseRow.getInputText()).thenReturn("환불 정책");
        when(caseRow.getContextJson()).thenReturn(Map.of("question", "", "audience", "초보 사용자"));
        when(evalTestCaseRepository.findByDatasetIdAndEnabledTrueOrderByCaseOrderAsc(300L)).thenReturn(List.of(caseRow));

        EvalRunEstimateRequest request = new EvalRunEstimateRequest(
                200L,
                300L,
                EvalMode.CANDIDATE_ONLY,
                RubricTemplateCode.GENERAL_TEXT
        );

        // when
        var response = service.estimateRun(10L, 100L, 1L, request);

        // then
        assertThat(response.estimatedCases()).isEqualTo(1);
    }

    @Test
    @DisplayName("createRun은 후보 버전 템플릿 변수 누락 케이스가 있으면 실행을 거부한다")
    void createRun은_후보_버전_템플릿_변수_누락_케이스가_있으면_실행을_거부한다() {
        // given
        EvalAccessService evalAccessService = mock(EvalAccessService.class);
        EvalRunRepository evalRunRepository = mock(EvalRunRepository.class);
        EvalCaseResultRepository evalCaseResultRepository = mock(EvalCaseResultRepository.class);
        EvalTestCaseRepository evalTestCaseRepository = mock(EvalTestCaseRepository.class);
        PromptReleaseRepository promptReleaseRepository = mock(PromptReleaseRepository.class);

        EvalRunService service = new EvalRunService(
                evalAccessService,
                new EvalProperties(),
                evalRunRepository,
                evalCaseResultRepository,
                evalTestCaseRepository,
                mock(PromptEvalDefaultRepository.class),
                promptReleaseRepository,
                mock(PromptRepository.class),
                mock(PromptVersionRepository.class)
        );

        Prompt prompt = mock(Prompt.class);
        when(prompt.getId()).thenReturn(100L);
        Workspace workspace = mock(Workspace.class);
        when(workspace.getId()).thenReturn(10L);
        User user = mock(User.class);
        when(user.getId()).thenReturn(1L);

        EvalAccessService.PromptScope scope = new EvalAccessService.PromptScope(user, workspace, prompt);
        when(evalAccessService.requirePromptScope(10L, 100L, 1L)).thenReturn(scope);

        PromptVersion candidateVersion = mock(PromptVersion.class);
        when(candidateVersion.getId()).thenReturn(200L);
        when(candidateVersion.getVersionNo()).thenReturn(4);
        when(candidateVersion.getUserTemplate()).thenReturn("{{topic}}에 대해 {{audience}}에게 설명해줘");
        when(candidateVersion.getSystemPrompt()).thenReturn(null);
        when(evalAccessService.requirePromptVersion(prompt, 200L)).thenReturn(candidateVersion);

        EvalDataset dataset = mock(EvalDataset.class);
        when(dataset.getId()).thenReturn(300L);
        when(evalAccessService.requireDataset(10L, 300L)).thenReturn(dataset);

        EvalTestCase caseRow = mock(EvalTestCase.class);
        when(caseRow.getCaseOrder()).thenReturn(1);
        when(caseRow.getExternalId()).thenReturn("case-1");
        when(caseRow.getInputText()).thenReturn("환불 정책");
        when(caseRow.getContextJson()).thenReturn(Map.of("audience", "초보 사용자"));
        when(evalTestCaseRepository.findByDatasetIdAndEnabledTrueOrderByCaseOrderAsc(300L)).thenReturn(List.of(caseRow));

        EvalRunCreateRequest request = new EvalRunCreateRequest(
                200L,
                300L,
                EvalMode.CANDIDATE_ONLY,
                RubricTemplateCode.GENERAL_TEXT,
                null
        );

        // when // then
        assertThatThrownBy(() -> service.createRun(10L, 100L, 1L, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> {
                    BusinessException ex = (BusinessException) error;
                    assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT_VALUE);
                    assertThat(ex.getMessage()).contains("missing=topic");
                });
    }

    @Test
    @DisplayName("createRun 비교 모드는 운영 버전 템플릿 변수 누락도 함께 검증한다")
    void createRun_비교모드는_운영버전_템플릿_변수_누락도_함께_검증한다() {
        // given
        EvalAccessService evalAccessService = mock(EvalAccessService.class);
        EvalRunRepository evalRunRepository = mock(EvalRunRepository.class);
        EvalCaseResultRepository evalCaseResultRepository = mock(EvalCaseResultRepository.class);
        EvalTestCaseRepository evalTestCaseRepository = mock(EvalTestCaseRepository.class);
        PromptReleaseRepository promptReleaseRepository = mock(PromptReleaseRepository.class);

        EvalRunService service = new EvalRunService(
                evalAccessService,
                new EvalProperties(),
                evalRunRepository,
                evalCaseResultRepository,
                evalTestCaseRepository,
                mock(PromptEvalDefaultRepository.class),
                promptReleaseRepository,
                mock(PromptRepository.class),
                mock(PromptVersionRepository.class)
        );

        Prompt prompt = mock(Prompt.class);
        when(prompt.getId()).thenReturn(100L);
        Workspace workspace = mock(Workspace.class);
        when(workspace.getId()).thenReturn(10L);
        User user = mock(User.class);
        when(user.getId()).thenReturn(1L);

        EvalAccessService.PromptScope scope = new EvalAccessService.PromptScope(user, workspace, prompt);
        when(evalAccessService.requirePromptScope(10L, 100L, 1L)).thenReturn(scope);

        PromptVersion candidateVersion = mock(PromptVersion.class);
        when(candidateVersion.getId()).thenReturn(200L);
        when(candidateVersion.getVersionNo()).thenReturn(7);
        when(candidateVersion.getUserTemplate()).thenReturn("{{topic}}를 설명해줘");
        when(candidateVersion.getSystemPrompt()).thenReturn(null);
        when(evalAccessService.requirePromptVersion(prompt, 200L)).thenReturn(candidateVersion);

        PromptVersion activeVersion = mock(PromptVersion.class);
        when(activeVersion.getId()).thenReturn(201L);
        when(activeVersion.getVersionNo()).thenReturn(3);
        when(activeVersion.getUserTemplate()).thenReturn("{{style}} 톤으로 답변해줘");
        when(activeVersion.getSystemPrompt()).thenReturn(null);

        PromptRelease release = mock(PromptRelease.class);
        when(release.getActiveVersion()).thenReturn(activeVersion);
        when(promptReleaseRepository.findWithActiveVersionByPromptId(100L)).thenReturn(Optional.of(release));

        EvalDataset dataset = mock(EvalDataset.class);
        when(dataset.getId()).thenReturn(300L);
        when(evalAccessService.requireDataset(10L, 300L)).thenReturn(dataset);

        EvalTestCase caseRow = mock(EvalTestCase.class);
        when(caseRow.getCaseOrder()).thenReturn(1);
        when(caseRow.getExternalId()).thenReturn("case-compare-1");
        when(caseRow.getInputText()).thenReturn("환불 정책");
        when(caseRow.getContextJson()).thenReturn(Map.of("topic", "환불 정책"));
        when(evalTestCaseRepository.findByDatasetIdAndEnabledTrueOrderByCaseOrderAsc(300L)).thenReturn(List.of(caseRow));

        EvalRunCreateRequest request = new EvalRunCreateRequest(
                200L,
                300L,
                EvalMode.COMPARE_ACTIVE,
                RubricTemplateCode.GENERAL_TEXT,
                null
        );

        // when // then
        assertThatThrownBy(() -> service.createRun(10L, 100L, 1L, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> {
                    BusinessException ex = (BusinessException) error;
                    assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT_VALUE);
                    assertThat(ex.getMessage()).contains("운영 버전(Active)");
                    assertThat(ex.getMessage()).contains("missing=style");
                });
    }

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
        assertThat(picked.get(0).getStartedAt()).isNotNull();
        assertThat(picked.get(0).getTimeoutAt()).isNotNull();
        assertThat(picked.get(0).getTimeoutAt()).isAfterOrEqualTo(picked.get(0).getStartedAt());
        verify(evalRunRepository).saveAll(picked);

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(evalRunRepository).findQueuedRunsForUpdate(eq(EvalRunStatus.QUEUED.name()), pageableCaptor.capture());
        assertThat(pageableCaptor.getValue().getPageNumber()).isEqualTo(0);
        assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(3);
    }

    @Test
    @DisplayName("recoverStuckRuns는 RUNNING run과 RUNNING case를 함께 QUEUED로 복구한다")
    void recoverStuckRuns는_running_run과_case를_queued로_복구한다() {
        // given
        EvalRunRepository evalRunRepository = mock(EvalRunRepository.class);
        EvalCaseResultRepository evalCaseResultRepository = mock(EvalCaseResultRepository.class);
        EvalRunService service = new EvalRunService(
                mock(EvalAccessService.class),
                new EvalProperties(),
                evalRunRepository,
                evalCaseResultRepository,
                mock(EvalTestCaseRepository.class),
                mock(PromptEvalDefaultRepository.class),
                mock(PromptReleaseRepository.class),
                mock(PromptRepository.class),
                mock(PromptVersionRepository.class)
        );

        EvalRun stuckRun = EvalRun.queue(
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
        stuckRun.markRunningWithTimeout(Duration.ofMinutes(30));

        EvalCaseResult runningCase = EvalCaseResult.queue(stuckRun, mock(EvalTestCase.class));
        runningCase.markRunning();

        when(evalRunRepository.findStuckRunsForUpdate(
                eq(EvalRunStatus.RUNNING.name()),
                any(LocalDateTime.class),
                any(Pageable.class)
        )).thenReturn(List.of(stuckRun), List.of());
        when(evalCaseResultRepository.findByEvalRunIdInAndStatusOrderByEvalRunIdAscIdAsc(
                anyList(),
                eq(EvalCaseStatus.RUNNING.name())
        )).thenReturn(List.of(runningCase));

        // when
        int recovered = service.recoverStuckRuns(Duration.ofMinutes(30));

        // then
        assertThat(recovered).isEqualTo(1);
        assertThat(stuckRun.status()).isEqualTo(EvalRunStatus.QUEUED);
        assertThat(stuckRun.getStartedAt()).isNull();
        assertThat(stuckRun.getTimeoutAt()).isNull();
        assertThat(runningCase.status()).isEqualTo(EvalCaseStatus.QUEUED);
        assertThat(runningCase.getStartedAt()).isNull();
        assertThat(runningCase.getCompletedAt()).isNull();

        verify(evalRunRepository).saveAll(List.of(stuckRun));
        verify(evalCaseResultRepository).saveAll(List.of(runningCase));
    }
}
