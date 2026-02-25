package com.llm_ops.demo.eval.service;

import com.llm_ops.demo.eval.domain.PromptEvalDefault;
import com.llm_ops.demo.eval.domain.EvalDataset;
import com.llm_ops.demo.eval.dto.PromptEvalDefaultResponse;
import com.llm_ops.demo.eval.dto.PromptEvalDefaultUpsertRequest;
import com.llm_ops.demo.eval.repository.PromptEvalDefaultRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PromptEvalDefaultService {

    private final EvalAccessService evalAccessService;
    private final PromptEvalDefaultRepository promptEvalDefaultRepository;

    public PromptEvalDefaultService(
            EvalAccessService evalAccessService,
            PromptEvalDefaultRepository promptEvalDefaultRepository
    ) {
        this.evalAccessService = evalAccessService;
        this.promptEvalDefaultRepository = promptEvalDefaultRepository;
    }

    @Transactional(readOnly = true)
    public PromptEvalDefaultResponse get(Long workspaceId, Long promptId, Long userId) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);
        return promptEvalDefaultRepository.findByPromptId(scope.prompt().getId())
                .map(PromptEvalDefaultResponse::from)
                .orElse(null);
    }

    @Transactional
    public PromptEvalDefaultResponse upsert(
            Long workspaceId,
            Long promptId,
            Long userId,
            PromptEvalDefaultUpsertRequest request
    ) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);

        EvalDataset dataset = request.datasetId() != null
                ? evalAccessService.requireDataset(workspaceId, request.datasetId())
                : null;
        boolean autoEvalEnabled = request.autoEvalEnabled() != null && request.autoEvalEnabled().booleanValue();

        PromptEvalDefault value = promptEvalDefaultRepository.findByPromptId(scope.prompt().getId())
                .map(existing -> {
                    existing.update(
                            dataset,
                            request.rubricTemplateCode(),
                            request.rubricOverrides(),
                            request.criteriaAnchors(),
                            request.defaultMode(),
                            autoEvalEnabled,
                            scope.user().getId()
                    );
                    return existing;
                })
                .orElseGet(() -> PromptEvalDefault.create(
                        scope.prompt(),
                        dataset,
                        request.rubricTemplateCode(),
                        request.rubricOverrides(),
                        request.criteriaAnchors(),
                        request.defaultMode(),
                        autoEvalEnabled,
                        scope.user().getId()
                ));

        return PromptEvalDefaultResponse.from(promptEvalDefaultRepository.save(value));
    }
}
