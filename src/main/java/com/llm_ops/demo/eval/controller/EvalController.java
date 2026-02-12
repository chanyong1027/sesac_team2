package com.llm_ops.demo.eval.controller;

import com.llm_ops.demo.eval.dto.EvalBulkUploadRequest;
import com.llm_ops.demo.eval.dto.EvalBulkUploadResponse;
import com.llm_ops.demo.eval.dto.EvalCancelResponse;
import com.llm_ops.demo.eval.dto.EvalCaseResultListResponse;
import com.llm_ops.demo.eval.dto.EvalCaseResultResponse;
import com.llm_ops.demo.eval.dto.EvalDatasetCreateRequest;
import com.llm_ops.demo.eval.dto.EvalDatasetResponse;
import com.llm_ops.demo.eval.dto.EvalRunCreateRequest;
import com.llm_ops.demo.eval.dto.EvalRunEstimateRequest;
import com.llm_ops.demo.eval.dto.EvalRunEstimateResponse;
import com.llm_ops.demo.eval.dto.EvalRunResponse;
import com.llm_ops.demo.eval.dto.EvalTestCaseResponse;
import com.llm_ops.demo.eval.dto.PromptEvalDefaultResponse;
import com.llm_ops.demo.eval.dto.PromptEvalDefaultUpsertRequest;
import com.llm_ops.demo.eval.service.EvalDatasetService;
import com.llm_ops.demo.eval.service.EvalRunService;
import com.llm_ops.demo.eval.service.PromptEvalDefaultService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/prompts/{promptId}/eval")
@RequiredArgsConstructor
public class EvalController {

    private final EvalDatasetService evalDatasetService;
    private final PromptEvalDefaultService promptEvalDefaultService;
    private final EvalRunService evalRunService;

    @PostMapping("/datasets")
    public ResponseEntity<EvalDatasetResponse> createDataset(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody EvalDatasetCreateRequest request
    ) {
        EvalDatasetResponse response = evalDatasetService.create(workspaceId, promptId, userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/datasets")
    public ResponseEntity<List<EvalDatasetResponse>> getDatasets(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @AuthenticationPrincipal Long userId
    ) {
        return ResponseEntity.ok(evalDatasetService.list(workspaceId, promptId, userId));
    }

    @GetMapping("/datasets/{datasetId}")
    public ResponseEntity<EvalDatasetResponse> getDataset(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @PathVariable Long datasetId,
            @AuthenticationPrincipal Long userId
    ) {
        return ResponseEntity.ok(evalDatasetService.get(workspaceId, promptId, datasetId, userId));
    }

    @GetMapping("/datasets/{datasetId}/testcases")
    public ResponseEntity<List<EvalTestCaseResponse>> getDatasetCases(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @PathVariable Long datasetId,
            @AuthenticationPrincipal Long userId
    ) {
        return ResponseEntity.ok(evalDatasetService.listTestCases(workspaceId, promptId, datasetId, userId));
    }

    @PostMapping("/datasets/{datasetId}/testcases:bulk-upload")
    public ResponseEntity<EvalBulkUploadResponse> bulkUploadTestCases(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @PathVariable Long datasetId,
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody EvalBulkUploadRequest request
    ) {
        EvalBulkUploadResponse response = evalDatasetService.bulkUpload(workspaceId, promptId, datasetId, userId, request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/defaults")
    public ResponseEntity<PromptEvalDefaultResponse> getDefaults(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @AuthenticationPrincipal Long userId
    ) {
        return ResponseEntity.ok(promptEvalDefaultService.get(workspaceId, promptId, userId));
    }

    @PutMapping("/defaults")
    public ResponseEntity<PromptEvalDefaultResponse> upsertDefaults(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody PromptEvalDefaultUpsertRequest request
    ) {
        return ResponseEntity.ok(promptEvalDefaultService.upsert(workspaceId, promptId, userId, request));
    }

    @PostMapping("/runs")
    public ResponseEntity<EvalRunResponse> createRun(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody EvalRunCreateRequest request
    ) {
        EvalRunResponse response = evalRunService.createRun(workspaceId, promptId, userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/runs:estimate")
    public ResponseEntity<EvalRunEstimateResponse> estimateRun(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody EvalRunEstimateRequest request
    ) {
        return ResponseEntity.ok(evalRunService.estimateRun(workspaceId, promptId, userId, request));
    }

    @GetMapping("/runs")
    public ResponseEntity<List<EvalRunResponse>> getRuns(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @AuthenticationPrincipal Long userId
    ) {
        return ResponseEntity.ok(evalRunService.listRuns(workspaceId, promptId, userId));
    }

    @GetMapping("/runs/{runId}")
    public ResponseEntity<EvalRunResponse> getRun(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @PathVariable Long runId,
            @AuthenticationPrincipal Long userId
    ) {
        return ResponseEntity.ok(evalRunService.getRun(workspaceId, promptId, runId, userId));
    }

    @PostMapping("/runs/{runId}:cancel")
    public ResponseEntity<EvalCancelResponse> cancelRun(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @PathVariable Long runId,
            @AuthenticationPrincipal Long userId
    ) {
        return ResponseEntity.ok(evalRunService.cancelRun(workspaceId, promptId, runId, userId));
    }

    @GetMapping("/runs/{runId}/cases")
    public ResponseEntity<EvalCaseResultListResponse> getRunCases(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @PathVariable Long runId,
            @AuthenticationPrincipal Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(evalRunService.getRunCases(workspaceId, promptId, runId, userId, page, size));
    }

    @GetMapping("/runs/{runId}/cases/{caseResultId}")
    public ResponseEntity<EvalCaseResultResponse> getRunCase(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @PathVariable Long runId,
            @PathVariable Long caseResultId,
            @AuthenticationPrincipal Long userId
    ) {
        return ResponseEntity.ok(evalRunService.getRunCase(workspaceId, promptId, runId, caseResultId, userId));
    }
}
