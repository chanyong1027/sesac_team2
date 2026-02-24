package com.llm_ops.demo.eval.service;

import com.llm_ops.demo.eval.domain.EvalCaseResult;
import com.llm_ops.demo.eval.domain.EvalCaseResultHumanReviewAudit;
import com.llm_ops.demo.eval.domain.EvalCaseStatus;
import com.llm_ops.demo.eval.domain.EvalHumanReviewVerdict;
import com.llm_ops.demo.eval.domain.EvalRun;
import com.llm_ops.demo.eval.repository.EvalCaseResultHumanReviewAuditRepository;
import com.llm_ops.demo.eval.repository.EvalCaseResultRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EvalHumanReviewService {

    private final EvalCaseResultRepository evalCaseResultRepository;
    private final EvalCaseResultHumanReviewAuditRepository evalCaseResultHumanReviewAuditRepository;
    private final EvalAccessService evalAccessService;

    public EvalHumanReviewService(
            EvalCaseResultRepository evalCaseResultRepository,
            EvalCaseResultHumanReviewAuditRepository evalCaseResultHumanReviewAuditRepository,
            EvalAccessService evalAccessService
    ) {
        this.evalCaseResultRepository = evalCaseResultRepository;
        this.evalCaseResultHumanReviewAuditRepository = evalCaseResultHumanReviewAuditRepository;
        this.evalAccessService = evalAccessService;
    }

    @Transactional
    public EvalCaseResult upsertReview(
            Long workspaceId,
            Long promptId,
            Long runId,
            Long evalCaseResultId,
            Long userId,
            EvalHumanReviewVerdict verdict,
            Boolean overridePass,
            String comment,
            String category,
            String requestId
    ) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);
        EvalRun evalRun = evalAccessService.requireRun(scope.prompt(), runId);

        EvalCaseResult evalCaseResult = evalCaseResultRepository.findByIdAndEvalRunId(evalCaseResultId, runId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        if (evalCaseResult.status() != EvalCaseStatus.OK) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE);
        }

        String normalizedRequestId = normalizeRequestId(requestId);
        if (normalizedRequestId != null
                && evalCaseResultHumanReviewAuditRepository.existsByEvalCaseResultIdAndRequestId(
                        evalCaseResultId,
                        normalizedRequestId
                )) {
            return evalCaseResult;
        }

        if (verdict == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE);
        }

        if (verdict == EvalHumanReviewVerdict.UNREVIEWED) {
            return clearReviewInternal(workspaceId, evalRun, evalCaseResult, evalCaseResultId, userId, normalizedRequestId);
        }

        String normalizedCategory = normalizeCategory(category);
        Boolean storedPass = resolveStoredPass(evalCaseResultId, runId);
        validateUpsertReview(storedPass, verdict, overridePass);

        OffsetDateTime now = OffsetDateTime.now();
        evalCaseResult.applyHumanReviewUpdate(
                verdict,
                overridePass,
                comment,
                normalizedCategory,
                userId,
                now
        );

        EvalCaseResult saved = evalCaseResultRepository.saveAndFlush(evalCaseResult);
        saveAudit(
                workspaceId,
                evalCaseResultId,
                evalRun,
                saved,
                verdict,
                overridePass,
                comment,
                normalizedCategory,
                normalizedRequestId,
                userId
        );
        return saved;
    }

    @Transactional
    public EvalCaseResult clearReview(
            Long workspaceId,
            Long promptId,
            Long runId,
            Long evalCaseResultId,
            Long userId,
            String requestId
    ) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);
        EvalRun evalRun = evalAccessService.requireRun(scope.prompt(), runId);

        EvalCaseResult evalCaseResult = evalCaseResultRepository.findByIdAndEvalRunId(evalCaseResultId, runId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        if (evalCaseResult.status() != EvalCaseStatus.OK) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE);
        }

        String normalizedRequestId = normalizeRequestId(requestId);
        if (normalizedRequestId != null
                && evalCaseResultHumanReviewAuditRepository.existsByEvalCaseResultIdAndRequestId(
                        evalCaseResultId,
                        normalizedRequestId
                )) {
            return evalCaseResult;
        }

        return clearReviewInternal(workspaceId, evalRun, evalCaseResult, evalCaseResultId, userId, normalizedRequestId);
    }

    @Transactional(readOnly = true)
    public List<EvalCaseResultHumanReviewAudit> listReviewHistory(
            Long workspaceId,
            Long promptId,
            Long runId,
            Long evalCaseResultId,
            Long userId
    ) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);
        evalAccessService.requireRun(scope.prompt(), runId);

        evalCaseResultRepository.findByIdAndEvalRunId(evalCaseResultId, runId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        return evalCaseResultHumanReviewAuditRepository
                .findTop20ByEvalCaseResultIdOrderByChangedAtDesc(evalCaseResultId);
    }

    private EvalCaseResult clearReviewInternal(
            Long workspaceId,
            EvalRun evalRun,
            EvalCaseResult evalCaseResult,
            Long evalCaseResultId,
            Long userId,
            String requestId
    ) {
        evalCaseResult.applyHumanReviewUpdate(
                EvalHumanReviewVerdict.UNREVIEWED,
                null,
                null,
                null,
                null,
                null
        );

        EvalCaseResult saved = evalCaseResultRepository.saveAndFlush(evalCaseResult);
        saveAudit(
                workspaceId,
                evalCaseResultId,
                evalRun,
                saved,
                EvalHumanReviewVerdict.UNREVIEWED,
                null,
                null,
                null,
                requestId,
                userId
        );
        return saved;
    }

    private Boolean resolveStoredPass(Long evalCaseResultId, Long runId) {
        EvalCaseResultRepository.PassProjection projection = evalCaseResultRepository
                .findPassProjectionByIdAndEvalRunId(evalCaseResultId, runId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        return projection.getPass();
    }

    private void validateUpsertReview(Boolean storedPass, EvalHumanReviewVerdict verdict, Boolean overridePass) {
        if (storedPass == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE);
        }

        if (verdict == EvalHumanReviewVerdict.CORRECT) {
            if (overridePass != null) {
                throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE);
            }
            return;
        }

        if (verdict == EvalHumanReviewVerdict.INCORRECT) {
            if (overridePass == null) {
                throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE);
            }
            if (overridePass.equals(storedPass)) {
                throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE);
            }
            return;
        }

        throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE);
    }

    private String normalizeCategory(String category) {
        if (category == null || category.isBlank()) {
            return null;
        }
        String normalized = category.trim();
        if (normalized.length() > 50) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE);
        }
        return normalized;
    }

    private String normalizeRequestId(String requestId) {
        if (requestId == null || requestId.isBlank()) {
            return null;
        }
        String normalized = requestId.trim();
        if (normalized.length() > 120) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE);
        }
        return normalized;
    }

    private void saveAudit(
            Long workspaceId,
            Long evalCaseResultId,
            EvalRun evalRun,
            EvalCaseResult evalCaseResult,
            EvalHumanReviewVerdict verdict,
            Boolean overridePass,
            String comment,
            String category,
            String requestId,
            Long userId
    ) {
        try {
            evalCaseResultHumanReviewAuditRepository.save(
                    EvalCaseResultHumanReviewAudit.create(
                            workspaceId,
                            evalRun,
                            evalCaseResult,
                            verdict,
                            overridePass,
                            comment,
                            category,
                            requestId,
                            userId
                    )
            );
        } catch (DataIntegrityViolationException e) {
            if (requestId != null
                    && evalCaseResultHumanReviewAuditRepository.existsByEvalCaseResultIdAndRequestId(
                            evalCaseResultId,
                            requestId
                    )) {
                return;
            }
            throw e;
        }
    }
}
