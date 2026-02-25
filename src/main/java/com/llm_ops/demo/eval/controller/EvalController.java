package com.llm_ops.demo.eval.controller;

import com.llm_ops.demo.eval.dto.EvalBulkUploadRequest;
import com.llm_ops.demo.eval.dto.EvalBulkUploadResponse;
import com.llm_ops.demo.eval.dto.EvalCancelResponse;
import com.llm_ops.demo.eval.dto.EvalCaseHumanReviewAuditResponse;
import com.llm_ops.demo.eval.dto.EvalCaseHumanReviewUpsertRequest;
import com.llm_ops.demo.eval.dto.EvalCaseResultListResponse;
import com.llm_ops.demo.eval.dto.EvalCaseResultResponse;
import com.llm_ops.demo.eval.dto.EvalCaseResultStatsResponse;
import com.llm_ops.demo.eval.dto.EvalCaseResultTableListResponse;
import com.llm_ops.demo.eval.dto.EvalDatasetCreateRequest;
import com.llm_ops.demo.eval.dto.EvalDatasetResponse;
import com.llm_ops.demo.eval.dto.EvalRunCreateRequest;
import com.llm_ops.demo.eval.dto.EvalRunEstimateRequest;
import com.llm_ops.demo.eval.dto.EvalRunEstimateResponse;
import com.llm_ops.demo.eval.dto.EvalRunResponse;
import com.llm_ops.demo.eval.dto.EvalTestCaseResponse;
import com.llm_ops.demo.eval.dto.EvalJudgeAccuracyMetricsResponse;
import com.llm_ops.demo.eval.dto.EvalJudgeAccuracyRollupResponse;
import com.llm_ops.demo.eval.dto.PromptEvalDefaultResponse;
import com.llm_ops.demo.eval.dto.PromptEvalDefaultDraftResponse;
import com.llm_ops.demo.eval.dto.PromptEvalDefaultDraftSectionRequest;
import com.llm_ops.demo.eval.dto.PromptEvalDefaultUpsertRequest;
import com.llm_ops.demo.eval.domain.EvalCaseStatus;
import com.llm_ops.demo.eval.domain.EvalHumanReviewVerdict;
import com.llm_ops.demo.eval.service.EvalCaseResultStatsService;
import com.llm_ops.demo.eval.service.EvalDatasetService;
import com.llm_ops.demo.eval.service.EvalHumanReviewService;
import com.llm_ops.demo.eval.service.EvalJudgeAccuracyMetricsService;
import com.llm_ops.demo.eval.service.EvalRunService;
import com.llm_ops.demo.eval.service.PromptEvalDefaultDraftService;
import com.llm_ops.demo.eval.service.PromptEvalDefaultService;
import jakarta.validation.Valid;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/prompts/{promptId}/eval")
public class EvalController {

    private final EvalDatasetService evalDatasetService;
    private final PromptEvalDefaultService promptEvalDefaultService;
    private final PromptEvalDefaultDraftService promptEvalDefaultDraftService;
    private final EvalRunService evalRunService;
    private final EvalHumanReviewService evalHumanReviewService;
    private final EvalCaseResultStatsService evalCaseResultStatsService;
    private final EvalJudgeAccuracyMetricsService evalJudgeAccuracyMetricsService;

    public EvalController(
            EvalDatasetService evalDatasetService,
            PromptEvalDefaultService promptEvalDefaultService,
            PromptEvalDefaultDraftService promptEvalDefaultDraftService,
            EvalRunService evalRunService,
            EvalHumanReviewService evalHumanReviewService,
            EvalCaseResultStatsService evalCaseResultStatsService,
            EvalJudgeAccuracyMetricsService evalJudgeAccuracyMetricsService
    ) {
        this.evalDatasetService = evalDatasetService;
        this.promptEvalDefaultService = promptEvalDefaultService;
        this.promptEvalDefaultDraftService = promptEvalDefaultDraftService;
        this.evalRunService = evalRunService;
        this.evalHumanReviewService = evalHumanReviewService;
        this.evalCaseResultStatsService = evalCaseResultStatsService;
        this.evalJudgeAccuracyMetricsService = evalJudgeAccuracyMetricsService;
    }

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

    @GetMapping("/defaults/draft")
    public ResponseEntity<PromptEvalDefaultDraftResponse> getDefaultsDraft(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @AuthenticationPrincipal Long userId
    ) {
        return ResponseEntity.ok(promptEvalDefaultDraftService.getDraft(workspaceId, promptId, userId));
    }

    @PatchMapping("/defaults/draft/sections/dataset")
    public ResponseEntity<PromptEvalDefaultDraftResponse> patchDefaultsDraftDataset(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @AuthenticationPrincipal Long userId,
            @RequestBody PromptEvalDefaultDraftSectionRequest request
    ) {
        return ResponseEntity.ok(
                promptEvalDefaultDraftService.patchDatasetSection(
                        workspaceId,
                        promptId,
                        userId,
                        request != null ? request.datasetId() : null
                )
        );
    }

    @PatchMapping("/defaults/draft/sections/rubric")
    public ResponseEntity<PromptEvalDefaultDraftResponse> patchDefaultsDraftRubric(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @AuthenticationPrincipal Long userId,
            @RequestBody PromptEvalDefaultDraftSectionRequest request
    ) {
        return ResponseEntity.ok(
                promptEvalDefaultDraftService.patchRubricSection(
                        workspaceId,
                        promptId,
                        userId,
                        request != null ? request.rubricTemplateCode() : null,
                        request != null ? request.rubricOverrides() : null,
                        request != null ? request.criteriaAnchors() : null
                )
        );
    }

    @PatchMapping("/defaults/draft/sections/mode")
    public ResponseEntity<PromptEvalDefaultDraftResponse> patchDefaultsDraftMode(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @AuthenticationPrincipal Long userId,
            @RequestBody PromptEvalDefaultDraftSectionRequest request
    ) {
        return ResponseEntity.ok(
                promptEvalDefaultDraftService.patchModeSection(
                        workspaceId,
                        promptId,
                        userId,
                        request != null ? request.defaultMode() : null
                )
        );
    }

    @PatchMapping("/defaults/draft/sections/automation")
    public ResponseEntity<PromptEvalDefaultDraftResponse> patchDefaultsDraftAutomation(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @AuthenticationPrincipal Long userId,
            @RequestBody PromptEvalDefaultDraftSectionRequest request
    ) {
        return ResponseEntity.ok(
                promptEvalDefaultDraftService.patchAutomationSection(
                        workspaceId,
                        promptId,
                        userId,
                        request != null ? request.autoEvalEnabled() : null
                )
        );
    }

    @PostMapping("/defaults/draft:finalize")
    public ResponseEntity<PromptEvalDefaultResponse> finalizeDefaultsDraft(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @AuthenticationPrincipal Long userId
    ) {
        return ResponseEntity.ok(promptEvalDefaultDraftService.finalizeDraft(workspaceId, promptId, userId));
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

    @GetMapping("/runs/{runId}/cases:table")
    public ResponseEntity<EvalCaseResultTableListResponse> getRunCasesTable(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @PathVariable Long runId,
            @AuthenticationPrincipal Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) EvalCaseStatus status,
            @RequestParam(required = false) Boolean pass,
            @RequestParam(required = false) EvalHumanReviewVerdict reviewVerdict,
            @RequestParam(required = false) Boolean overridden
    ) {
        return ResponseEntity.ok(
                evalCaseResultStatsService.getCaseTable(
                        workspaceId,
                        promptId,
                        runId,
                        userId,
                        page,
                        size,
                        status,
                        pass,
                        reviewVerdict,
                        overridden
                )
        );
    }

    @GetMapping("/runs/{runId}/cases:stats")
    public ResponseEntity<EvalCaseResultStatsResponse> getRunCasesStats(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @PathVariable Long runId,
            @AuthenticationPrincipal Long userId
    ) {
        return ResponseEntity.ok(evalCaseResultStatsService.getCaseStats(workspaceId, promptId, runId, userId));
    }

    @GetMapping("/runs/{runId}/judge-accuracy")
    public ResponseEntity<EvalJudgeAccuracyMetricsResponse> getRunJudgeAccuracy(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @PathVariable Long runId,
            @AuthenticationPrincipal Long userId
    ) {
        return ResponseEntity.ok(
                evalJudgeAccuracyMetricsService.getRunMetrics(workspaceId, promptId, runId, userId)
        );
    }

    @GetMapping("/judge-accuracy")
    public ResponseEntity<EvalJudgeAccuracyRollupResponse> getPromptJudgeAccuracyRollup(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @AuthenticationPrincipal Long userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(required = false) Long promptVersionId
    ) {
        return ResponseEntity.ok(
                evalJudgeAccuracyMetricsService.getPromptRollup(
                        workspaceId,
                        promptId,
                        userId,
                        from,
                        to,
                        promptVersionId
                )
        );
    }

    @PutMapping("/runs/{runId}/cases/{caseResultId}/human-review")
    public ResponseEntity<EvalCaseResultResponse> upsertHumanReview(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @PathVariable Long runId,
            @PathVariable Long caseResultId,
            @AuthenticationPrincipal Long userId,
            @Valid @RequestBody EvalCaseHumanReviewUpsertRequest request
    ) {
        return ResponseEntity.ok(
                EvalCaseResultResponse.from(
                        evalHumanReviewService.upsertReview(
                                workspaceId,
                                promptId,
                                runId,
                                caseResultId,
                                userId,
                                request.verdict(),
                                request.overridePass(),
                                request.comment(),
                                request.category(),
                                request.requestId()
                        )
                )
        );
    }

    @GetMapping("/runs/{runId}/cases/{caseResultId}/human-review/history")
    public ResponseEntity<List<EvalCaseHumanReviewAuditResponse>> getHumanReviewHistory(
            @PathVariable Long workspaceId,
            @PathVariable Long promptId,
            @PathVariable Long runId,
            @PathVariable Long caseResultId,
            @AuthenticationPrincipal Long userId
    ) {
        List<EvalCaseHumanReviewAuditResponse> response = evalHumanReviewService
                .listReviewHistory(workspaceId, promptId, runId, caseResultId, userId)
                .stream()
                .map(EvalCaseHumanReviewAuditResponse::from)
                .toList();

        return ResponseEntity.ok(response);
    }
}
