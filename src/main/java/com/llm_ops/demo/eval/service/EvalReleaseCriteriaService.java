package com.llm_ops.demo.eval.service;

import com.llm_ops.demo.eval.domain.EvalReleaseCriteria;
import com.llm_ops.demo.eval.domain.EvalReleaseCriteriaAudit;
import com.llm_ops.demo.eval.dto.EvalReleaseCriteriaAuditResponse;
import com.llm_ops.demo.eval.dto.EvalReleaseCriteriaResponse;
import com.llm_ops.demo.eval.dto.EvalReleaseCriteriaUpdateRequest;
import com.llm_ops.demo.eval.repository.EvalReleaseCriteriaAuditRepository;
import com.llm_ops.demo.eval.repository.EvalReleaseCriteriaRepository;
import java.util.List;
import com.llm_ops.demo.workspace.service.WorkspaceAccessService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EvalReleaseCriteriaService {

    private final EvalReleaseCriteriaRepository evalReleaseCriteriaRepository;
    private final EvalReleaseCriteriaAuditRepository evalReleaseCriteriaAuditRepository;
    private final WorkspaceAccessService workspaceAccessService;

    public EvalReleaseCriteriaService(
            EvalReleaseCriteriaRepository evalReleaseCriteriaRepository,
            EvalReleaseCriteriaAuditRepository evalReleaseCriteriaAuditRepository,
            WorkspaceAccessService workspaceAccessService
    ) {
        this.evalReleaseCriteriaRepository = evalReleaseCriteriaRepository;
        this.evalReleaseCriteriaAuditRepository = evalReleaseCriteriaAuditRepository;
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
        workspaceAccessService.validateWorkspaceOwner(workspaceId, userId);

        EvalReleaseCriteria criteria = evalReleaseCriteriaRepository.findByWorkspaceId(workspaceId)
                .orElseGet(() -> EvalReleaseCriteria.createDefault(workspaceId));

        criteria.update(
                request.minPassRate(),
                request.minAvgOverallScore(),
                request.maxErrorRate(),
                request.minImprovementNoticeDelta(),
                userId
        );

        EvalReleaseCriteria saved = evalReleaseCriteriaRepository.saveAndFlush(criteria);
        evalReleaseCriteriaAuditRepository.save(EvalReleaseCriteriaAudit.create(saved, userId));
        return EvalReleaseCriteriaResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<EvalReleaseCriteriaAuditResponse> listHistory(Long workspaceId, Long userId) {
        workspaceAccessService.validateWorkspaceAccess(workspaceId, userId);
        return evalReleaseCriteriaAuditRepository.findTop20ByWorkspaceIdOrderByChangedAtDesc(workspaceId)
                .stream()
                .map(EvalReleaseCriteriaAuditResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public EvalReleaseCriteria resolveOrDefault(Long workspaceId) {
        return evalReleaseCriteriaRepository.findByWorkspaceId(workspaceId)
                .orElseGet(() -> EvalReleaseCriteria.createDefault(workspaceId));
    }
}
