package com.llm_ops.demo.gateway.log.controller;

import com.llm_ops.demo.auth.dto.response.ApiResponse;
import com.llm_ops.demo.gateway.log.domain.RequestLogStatus;
import com.llm_ops.demo.gateway.log.dto.RequestLogListResponse;
import com.llm_ops.demo.gateway.log.dto.RequestLogResponse;
import com.llm_ops.demo.gateway.log.dto.RequestLogSearchCondition;
import com.llm_ops.demo.gateway.log.service.RequestLogQueryService;
import com.llm_ops.demo.workspace.service.WorkspaceAccessService;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 로그 조회 API 컨트롤러
 */
@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/logs")
@RequiredArgsConstructor
public class RequestLogController {

    private final RequestLogQueryService requestLogQueryService;
    private final WorkspaceAccessService workspaceAccessService;

    /**
     * 로그 단건 조회
     * GET /api/v1/workspaces/{workspaceId}/logs/{traceId}
     */
    @GetMapping("/{traceId}")
    public ResponseEntity<ApiResponse<RequestLogResponse>> getLog(
            @PathVariable Long workspaceId,
            @PathVariable String traceId,
            @AuthenticationPrincipal Long userId) {
        workspaceAccessService.validateWorkspaceAccess(workspaceId, userId);
        RequestLogResponse response = requestLogQueryService.findByTraceId(workspaceId, traceId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * 로그 목록 조회
     * GET /api/v1/workspaces/{workspaceId}/logs
     */
    @GetMapping
    public ResponseEntity<ApiResponse<RequestLogListResponse>> getLogs(
            @PathVariable Long workspaceId,
            @AuthenticationPrincipal Long userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(required = false) RequestLogStatus status,
            @RequestParam(required = false) Boolean failover,
            @RequestParam(required = false) String provider,
            @RequestParam(required = false) String usedModel,
            @RequestParam(required = false) Boolean ragEnabled,
            @RequestParam(required = false) String promptKey,
            @RequestParam(required = false) String traceId,
            @RequestParam(required = false) String errorCode,
            @RequestParam(required = false) String requestSource,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {

        workspaceAccessService.validateWorkspaceAccess(workspaceId, userId);

        RequestLogSearchCondition condition = new RequestLogSearchCondition(
                from, to, status, failover, provider, usedModel, ragEnabled, promptKey, traceId,
                errorCode, requestSource);

        RequestLogListResponse response = requestLogQueryService.search(workspaceId, condition, pageable);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
