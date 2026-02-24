package com.llm_ops.demo.eval.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.eval.domain.EvalCaseResult;
import com.llm_ops.demo.eval.domain.EvalCaseStatus;
import com.llm_ops.demo.eval.domain.EvalHumanReviewVerdict;
import com.llm_ops.demo.eval.domain.EvalRun;
import com.llm_ops.demo.eval.domain.EvalTestCase;
import com.llm_ops.demo.eval.repository.EvalCaseResultHumanReviewAuditRepository;
import com.llm_ops.demo.eval.repository.EvalCaseResultRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.workspace.domain.Workspace;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class EvalHumanReviewServiceTest {

    private final EvalCaseResultRepository evalCaseResultRepository = mock(EvalCaseResultRepository.class);
    private final EvalCaseResultHumanReviewAuditRepository auditRepository = mock(EvalCaseResultHumanReviewAuditRepository.class);
    private final EvalAccessService evalAccessService = mock(EvalAccessService.class);

    private final EvalHumanReviewService service = new EvalHumanReviewService(
            evalCaseResultRepository,
            auditRepository,
            evalAccessService
    );

    @Test
    @DisplayName("verdict=INCORRECT일 때 overridePass가 없으면 INVALID_INPUT_VALUE를 던진다")
    void verdict_incorrect_인데_override가_없으면_예외() {
        // given
        Long workspaceId = 1L;
        Long promptId = 2L;
        Long runId = 3L;
        Long caseResultId = 4L;
        Long userId = 5L;

        EvalCaseResult caseResult = okCaseResult(true);
        EvalRun run = mock(EvalRun.class);
        when(run.getId()).thenReturn(runId);

        stubPromptScope(workspaceId, promptId, userId, runId, run);
        when(evalCaseResultRepository.findByIdAndEvalRunId(caseResultId, runId)).thenReturn(Optional.of(caseResult));
        when(evalCaseResultRepository.findPassProjectionByIdAndEvalRunId(caseResultId, runId))
                .thenReturn(Optional.of(() -> true));

        // when & then
        assertThatThrownBy(() -> service.upsertReview(
                workspaceId,
                promptId,
                runId,
                caseResultId,
                userId,
                EvalHumanReviewVerdict.INCORRECT,
                null,
                "comment",
                "quality",
                "req-1"
        )).isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_INPUT_VALUE);
    }

    @Test
    @DisplayName("같은 requestId로 재시도하면 현재 상태를 그대로 반환하고 중복 저장하지 않는다")
    void 같은_requestId_재시도는_멱등_처리한다() {
        // given
        Long workspaceId = 1L;
        Long promptId = 2L;
        Long runId = 3L;
        Long caseResultId = 4L;
        Long userId = 5L;

        EvalCaseResult caseResult = okCaseResult(true);
        EvalRun run = mock(EvalRun.class);
        when(run.getId()).thenReturn(runId);

        stubPromptScope(workspaceId, promptId, userId, runId, run);
        when(evalCaseResultRepository.findByIdAndEvalRunId(caseResultId, runId)).thenReturn(Optional.of(caseResult));
        when(auditRepository.existsByEvalCaseResultIdAndRequestId(caseResultId, "req-same")).thenReturn(true);

        // when
        EvalCaseResult result = service.upsertReview(
                workspaceId,
                promptId,
                runId,
                caseResultId,
                userId,
                EvalHumanReviewVerdict.CORRECT,
                null,
                "ok",
                "quality",
                "req-same"
        );

        // then
        assertThat(result).isSameAs(caseResult);
        verify(evalCaseResultRepository, never()).saveAndFlush(any());
        verify(auditRepository, never()).save(any());
    }

    @Test
    @DisplayName("정상 override 저장 시 effectivePass가 override 값으로 바뀌고 audit를 남긴다")
    void 정상_override_저장시_effectivePass_변경과_audit_저장() {
        // given
        Long workspaceId = 1L;
        Long promptId = 2L;
        Long runId = 3L;
        Long caseResultId = 4L;
        Long userId = 5L;

        EvalCaseResult caseResult = okCaseResult(false);
        EvalRun run = mock(EvalRun.class);
        when(run.getId()).thenReturn(runId);

        stubPromptScope(workspaceId, promptId, userId, runId, run);
        when(evalCaseResultRepository.findByIdAndEvalRunId(caseResultId, runId)).thenReturn(Optional.of(caseResult));
        when(auditRepository.existsByEvalCaseResultIdAndRequestId(caseResultId, "req-2")).thenReturn(false);
        when(evalCaseResultRepository.findPassProjectionByIdAndEvalRunId(caseResultId, runId))
                .thenReturn(Optional.of(() -> false));
        when(evalCaseResultRepository.saveAndFlush(caseResult)).thenReturn(caseResult);

        // when
        EvalCaseResult saved = service.upsertReview(
                workspaceId,
                promptId,
                runId,
                caseResultId,
                userId,
                EvalHumanReviewVerdict.INCORRECT,
                true,
                "manual override",
                "safety",
                "req-2"
        );

        // then
        assertThat(saved.getHumanReviewVerdict()).isEqualTo(EvalHumanReviewVerdict.INCORRECT);
        assertThat(saved.getHumanOverridePass()).isTrue();
        assertThat(saved.effectivePass()).isTrue();
        assertThat(saved.getHumanReviewedBy()).isEqualTo(userId);
        assertThat(saved.getHumanReviewedAt()).isNotNull();
        verify(auditRepository).save(any());
    }

    @Test
    @DisplayName("status가 OK가 아닌 케이스는 리뷰할 수 없다")
    void status_ok가_아니면_리뷰_불가() {
        // given
        Long workspaceId = 1L;
        Long promptId = 2L;
        Long runId = 3L;
        Long caseResultId = 4L;
        Long userId = 5L;

        EvalCaseResult queued = EvalCaseResult.queue(mock(EvalRun.class), mock(EvalTestCase.class));
        assertThat(queued.status()).isEqualTo(EvalCaseStatus.QUEUED);

        EvalRun run = mock(EvalRun.class);
        when(run.getId()).thenReturn(runId);
        stubPromptScope(workspaceId, promptId, userId, runId, run);
        when(evalCaseResultRepository.findByIdAndEvalRunId(caseResultId, runId)).thenReturn(Optional.of(queued));

        // when & then
        assertThatThrownBy(() -> service.upsertReview(
                workspaceId,
                promptId,
                runId,
                caseResultId,
                userId,
                EvalHumanReviewVerdict.CORRECT,
                null,
                null,
                null,
                null
        )).isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_INPUT_VALUE);
    }

    private EvalCaseResult okCaseResult(boolean pass) {
        EvalCaseResult result = EvalCaseResult.queue(mock(EvalRun.class), mock(EvalTestCase.class));
        result.markOk("candidate", null, Map.of(), Map.of(), Map.of(), Map.of(), 4.0d, pass);
        return result;
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
