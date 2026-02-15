package com.llm_ops.demo.eval.service;

import com.llm_ops.demo.eval.domain.EvalDataset;
import com.llm_ops.demo.eval.domain.EvalTestCase;
import com.llm_ops.demo.eval.dto.EvalBulkUploadRequest;
import com.llm_ops.demo.eval.dto.EvalBulkUploadResponse;
import com.llm_ops.demo.eval.dto.EvalDatasetCreateRequest;
import com.llm_ops.demo.eval.dto.EvalDatasetResponse;
import com.llm_ops.demo.eval.dto.EvalTestCaseCreateRequest;
import com.llm_ops.demo.eval.dto.EvalTestCaseResponse;
import com.llm_ops.demo.eval.repository.EvalDatasetRepository;
import com.llm_ops.demo.eval.repository.EvalTestCaseRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EvalDatasetService {

    private final EvalAccessService evalAccessService;
    private final EvalDatasetRepository evalDatasetRepository;
    private final EvalTestCaseRepository evalTestCaseRepository;

    public EvalDatasetService(
            EvalAccessService evalAccessService,
            EvalDatasetRepository evalDatasetRepository,
            EvalTestCaseRepository evalTestCaseRepository
    ) {
        this.evalAccessService = evalAccessService;
        this.evalDatasetRepository = evalDatasetRepository;
        this.evalTestCaseRepository = evalTestCaseRepository;
    }

    @Transactional
    public EvalDatasetResponse create(Long workspaceId, Long promptId, Long userId, EvalDatasetCreateRequest request) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);
        EvalDataset dataset = EvalDataset.create(
                scope.workspace().getId(),
                request.name().trim(),
                request.description(),
                scope.user().getId()
        );
        return EvalDatasetResponse.from(evalDatasetRepository.save(dataset));
    }

    @Transactional(readOnly = true)
    public List<EvalDatasetResponse> list(Long workspaceId, Long promptId, Long userId) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);
        return evalDatasetRepository.findByWorkspaceIdOrderByCreatedAtDesc(scope.workspace().getId())
                .stream()
                .map(EvalDatasetResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public EvalDatasetResponse get(Long workspaceId, Long promptId, Long datasetId, Long userId) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);
        EvalDataset dataset = evalAccessService.requireDataset(scope.workspace().getId(), datasetId);
        return EvalDatasetResponse.from(dataset);
    }

    @Transactional(readOnly = true)
    public List<EvalTestCaseResponse> listTestCases(Long workspaceId, Long promptId, Long datasetId, Long userId) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);
        EvalDataset dataset = evalAccessService.requireDataset(scope.workspace().getId(), datasetId);
        return evalTestCaseRepository.findByDatasetIdOrderByCaseOrderAsc(dataset.getId())
                .stream()
                .map(EvalTestCaseResponse::from)
                .toList();
    }

    @Transactional
    public EvalBulkUploadResponse bulkUpload(
            Long workspaceId,
            Long promptId,
            Long datasetId,
            Long userId,
            EvalBulkUploadRequest request
    ) {
        EvalAccessService.PromptScope scope = evalAccessService.requirePromptScope(workspaceId, promptId, userId);
        EvalDataset dataset = evalAccessService.requireDataset(scope.workspace().getId(), datasetId);

        if (request.testCases() == null || request.testCases().isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "업로드할 testCase가 없습니다.");
        }

        int nextOrder = 1;
        if (request.isReplaceExisting()) {
            evalTestCaseRepository.deleteByDatasetId(dataset.getId());
        } else {
            nextOrder = evalTestCaseRepository.findMaxCaseOrder(dataset.getId()) + 1;
        }

        List<EvalTestCase> entities = new ArrayList<>();
        int order = nextOrder;
        for (EvalTestCaseCreateRequest testCaseRequest : request.testCases()) {
            String input = testCaseRequest.input() != null ? testCaseRequest.input().trim() : "";
            if (input.isBlank()) {
                throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "testCase input은 비어 있을 수 없습니다.");
            }
            EvalTestCase testCase = EvalTestCase.create(
                    dataset,
                    order++,
                    testCaseRequest.externalId(),
                    input,
                    testCaseRequest.contextJson(),
                    testCaseRequest.expectedJson(),
                    testCaseRequest.constraintsJson()
            );
            entities.add(testCase);
        }

        evalTestCaseRepository.saveAll(entities);
        return new EvalBulkUploadResponse(dataset.getId(), entities.size());
    }
}
