package com.llm_ops.demo.eval.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.eval.domain.EvalMode;
import com.llm_ops.demo.eval.domain.PromptEvalDefaultDraft;
import com.llm_ops.demo.eval.domain.RubricTemplateCode;
import com.llm_ops.demo.eval.dto.PromptEvalDefaultResponse;
import com.llm_ops.demo.eval.repository.PromptEvalDefaultDraftRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.workspace.domain.Workspace;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PromptEvalDefaultDraftServiceTest {

    private final EvalAccessService evalAccessService = mock(EvalAccessService.class);
    private final PromptEvalDefaultDraftRepository promptEvalDefaultDraftRepository = mock(PromptEvalDefaultDraftRepository.class);
    private final PromptEvalDefaultService promptEvalDefaultService = mock(PromptEvalDefaultService.class);

    private final PromptEvalDefaultDraftService service = new PromptEvalDefaultDraftService(
            evalAccessService,
            promptEvalDefaultDraftRepository,
            promptEvalDefaultService
    );

    @Test
    @DisplayName("finalize 시 dataset 섹션이 누락되면 INVALID_INPUT_VALUE를 반환한다")
    void finalize_requires_dataset_section() {
        // given
        Long workspaceId = 1L;
        Long promptId = 2L;
        Long userId = 3L;

        Prompt prompt = mock(Prompt.class);
        when(prompt.getId()).thenReturn(promptId);
        EvalAccessService.PromptScope scope = new EvalAccessService.PromptScope(mock(User.class), mock(Workspace.class), prompt);
        when(evalAccessService.requirePromptScope(workspaceId, promptId, userId)).thenReturn(scope);

        PromptEvalDefaultDraft draft = PromptEvalDefaultDraft.create(prompt, userId);
        draft.updateRubric(RubricTemplateCode.GENERAL_TEXT, Map.of(), Map.of(), userId);
        draft.updateMode(EvalMode.CANDIDATE_ONLY, userId);
        draft.updateAutomation(true, userId);

        when(promptEvalDefaultDraftRepository.findByPromptId(promptId)).thenReturn(Optional.of(draft));

        // when & then
        assertThatThrownBy(() -> service.finalizeDraft(workspaceId, promptId, userId))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_INPUT_VALUE);

        verify(promptEvalDefaultService, never()).upsert(any(), any(), any(), any());
    }

    @Test
    @DisplayName("finalize 시 4개 섹션이 모두 완료되면 default 설정을 저장하고 draft를 삭제한다")
    void finalize_succeeds_when_all_sections_completed() {
        // given
        Long workspaceId = 1L;
        Long promptId = 2L;
        Long userId = 3L;

        Prompt prompt = mock(Prompt.class);
        when(prompt.getId()).thenReturn(promptId);
        EvalAccessService.PromptScope scope = new EvalAccessService.PromptScope(mock(User.class), mock(Workspace.class), prompt);
        when(evalAccessService.requirePromptScope(workspaceId, promptId, userId)).thenReturn(scope);

        PromptEvalDefaultDraft draft = PromptEvalDefaultDraft.create(prompt, userId);
        draft.updateDataset(100L, userId);
        draft.updateRubric(RubricTemplateCode.GENERAL_TEXT, Map.of("minOverallScore", 80), Map.of(), userId);
        draft.updateMode(EvalMode.CANDIDATE_ONLY, userId);
        draft.updateAutomation(true, userId);

        when(promptEvalDefaultDraftRepository.findByPromptId(promptId)).thenReturn(Optional.of(draft));
        PromptEvalDefaultResponse expected = new PromptEvalDefaultResponse(
                promptId,
                100L,
                RubricTemplateCode.GENERAL_TEXT,
                Map.of("minOverallScore", 80),
                Map.of(),
                EvalMode.CANDIDATE_ONLY,
                true,
                userId,
                null
        );
        when(promptEvalDefaultService.upsert(eq(workspaceId), eq(promptId), eq(userId), any())).thenReturn(expected);

        // when
        PromptEvalDefaultResponse result = service.finalizeDraft(workspaceId, promptId, userId);

        // then
        assertThat(result).isEqualTo(expected);
        verify(promptEvalDefaultService).upsert(eq(workspaceId), eq(promptId), eq(userId), any());
        verify(promptEvalDefaultDraftRepository).delete(draft);
    }
}
