package com.llm_ops.demo.eval.service;

import com.llm_ops.demo.eval.domain.EvalReleaseCriteria;
import com.llm_ops.demo.eval.dto.EvalReleaseCriteriaResponse;
import com.llm_ops.demo.eval.dto.EvalReleaseCriteriaUpdateRequest;
import com.llm_ops.demo.eval.repository.EvalReleaseCriteriaRepository;
import com.llm_ops.demo.workspace.service.WorkspaceAccessService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EvalReleaseCriteriaService {

    private final EvalReleaseCriteriaRepository evalReleaseCriteriaRepository;
    private final WorkspaceAccessService workspaceAccessService;

    public EvalReleaseCriteriaService(
            EvalReleaseCriteriaRepository evalReleaseCriteriaRepository,
            WorkspaceAccessService workspaceAccessService
    ) {
        this.evalReleaseCriteriaRepository = evalReleaseCriteriaRepository;
        this.workspaceAccessService = workspaceAccessService;
    }

    @Transactional(readOnly = true)
    public EvalReleaseCriteriaResponse get(Long workspaceId, Long userId) {
        workspaceAccessService.validateWorkspaceAccess(workspaceId, userId);
        EvalReleaseCriteria criteria = resolveOrDefault(workspaceId);
        return EvalReleaseCriteriaResponse.from(criteria);
    }

    @Transactional
    public EvalReleaseCriteriaResponse upsert(Long workspaceId, Long userId, EvalReleaseCriteriaUpdateRequest request) {
        workspaceAccessService.validateWorkspaceAccess(workspaceId, userId);

        EvalReleaseCriteria criteria = evalReleaseCriteriaRepository.findByWorkspaceId(workspaceId)
                .orElseGet(() -> EvalReleaseCriteria.createDefault(workspaceId));

        criteria.update(
                request.minPassRate(),
                request.minAvgOverallScore(),
                request.maxErrorRate(),
                request.minImprovementNoticeDelta(),
                userId
        );

        EvalReleaseCriteria saved = evalReleaseCriteriaRepository.save(criteria);
        return EvalReleaseCriteriaResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public EvalReleaseCriteria resolveOrDefault(Long workspaceId) {
        return evalReleaseCriteriaRepository.findByWorkspaceId(workspaceId)
                .orElseGet(() -> EvalReleaseCriteria.createDefault(workspaceId));
    }
}
