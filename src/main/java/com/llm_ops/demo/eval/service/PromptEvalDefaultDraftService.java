package com.llm_ops.demo.eval.service;

import com.llm_ops.demo.eval.domain.PromptEvalDefaultDraft;
import com.llm_ops.demo.eval.dto.PromptEvalDefaultDraftResponse;
import com.llm_ops.demo.eval.dto.PromptEvalDefaultUpsertRequest;
import com.llm_ops.demo.eval.dto.PromptEvalDefaultResponse;
import com.llm_ops.demo.eval.domain.EvalMode;
import com.llm_ops.demo.eval.domain.RubricTemplateCode;
import com.llm_ops.demo.eval.repository.PromptEvalDefaultDraftRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PromptEvalDefaultDraftService {

    private final EvalAccessService evalAccessService;
    private final PromptEvalDefaultDraftRepository promptEvalDefaultDraftRepository;
    private final PromptEvalDefaultService promptEvalDefaultService;

    public PromptEvalDefaultDraftService(
            EvalAccessService evalAccessService,
            PromptEvalDefaultDraftRepository promptEvalDefaultDraftRepository,
            PromptEvalDefaultService promptEvalDefaultService
    ) {
        this.evalAccessService = evalAccessService;
        this.promptEvalDefaultDraftRepository = promptEvalDefaultDraftRepository;
        this.promptEvalDefaultService = promptEvalDefaultService;
    }

    @Transactional(readOnly = true)
    public PromptEvalDefaultDraftResponse getDraft(Long workspaceId, Long promptId, Long userId) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);
        return promptEvalDefaultDraftRepository.findByPromptId(scope.prompt().getId())
                .map(PromptEvalDefaultDraftResponse::from)
                .orElse(null);
    }

    @Transactional
    public PromptEvalDefaultDraftResponse patchDatasetSection(Long workspaceId, Long promptId, Long userId, Long datasetId) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);

        if (datasetId != null) {
            evalAccessService.requireDataset(workspaceId, datasetId);
        }

        PromptEvalDefaultDraft draft = resolveOrCreate(scope);
        draft.updateDataset(datasetId, scope.user().getId());
        return PromptEvalDefaultDraftResponse.from(promptEvalDefaultDraftRepository.save(draft));
    }

    @Transactional
    public PromptEvalDefaultDraftResponse patchRubricSection(
            Long workspaceId,
            Long promptId,
            Long userId,
            RubricTemplateCode rubricTemplateCode,
            Map<String, Object> rubricOverrides,
            Map<String, Object> criteriaAnchors
    ) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);
        if (rubricTemplateCode == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE);
        }

        PromptEvalDefaultDraft draft = resolveOrCreate(scope);
        draft.updateRubric(rubricTemplateCode, rubricOverrides, criteriaAnchors, scope.user().getId());
        return PromptEvalDefaultDraftResponse.from(promptEvalDefaultDraftRepository.save(draft));
    }

    @Transactional
    public PromptEvalDefaultDraftResponse patchModeSection(Long workspaceId, Long promptId, Long userId, EvalMode defaultMode) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);
        if (defaultMode == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE);
        }

        PromptEvalDefaultDraft draft = resolveOrCreate(scope);
        draft.updateMode(defaultMode, scope.user().getId());
        return PromptEvalDefaultDraftResponse.from(promptEvalDefaultDraftRepository.save(draft));
    }

    @Transactional
    public PromptEvalDefaultDraftResponse patchAutomationSection(Long workspaceId, Long promptId, Long userId, Boolean autoEvalEnabled) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);
        if (autoEvalEnabled == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE);
        }

        PromptEvalDefaultDraft draft = resolveOrCreate(scope);
        draft.updateAutomation(autoEvalEnabled, scope.user().getId());
        return PromptEvalDefaultDraftResponse.from(promptEvalDefaultDraftRepository.save(draft));
    }

    @Transactional
    public PromptEvalDefaultResponse finalizeDraft(Long workspaceId, Long promptId, Long userId) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);

        PromptEvalDefaultDraft draft = promptEvalDefaultDraftRepository.findByPromptId(scope.prompt().getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        validateFinalize(draft);

        PromptEvalDefaultUpsertRequest request = new PromptEvalDefaultUpsertRequest(
                draft.getDatasetId(),
                draft.rubricTemplateCode(),
                draft.getRubricOverridesJson(),
                draft.getCriteriaAnchorsJson(),
                draft.defaultMode(),
                draft.getAutoEvalEnabled()
        );

        PromptEvalDefaultResponse response = promptEvalDefaultService.upsert(workspaceId, promptId, userId, request);
        promptEvalDefaultDraftRepository.delete(draft);
        return response;
    }

    private PromptEvalDefaultDraft resolveOrCreate(EvalAccessService.PromptScope scope) {
        return promptEvalDefaultDraftRepository.findByPromptId(scope.prompt().getId())
                .orElseGet(() -> PromptEvalDefaultDraft.create(scope.prompt(), scope.user().getId()));
    }

    private void validateFinalize(PromptEvalDefaultDraft draft) {
        if (draft.rubricTemplateCode() == null
                || draft.defaultMode() == null
                || draft.getAutoEvalEnabled() == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE);
        }

        if (!draft.isSectionCompleted("rubric")
                || !draft.isSectionCompleted("mode")
                || !draft.isSectionCompleted("automation")) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE);
        }
    }
}
