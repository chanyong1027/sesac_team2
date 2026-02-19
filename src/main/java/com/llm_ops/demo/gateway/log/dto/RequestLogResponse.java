package com.llm_ops.demo.gateway.log.dto;

import com.llm_ops.demo.gateway.log.domain.RequestLog;
import com.llm_ops.demo.gateway.log.domain.RequestLogStatus;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 로그 단건/목록 조회 응답 DTO
 */
public record RequestLogResponse(
        UUID requestId,
        String traceId,
        RequestLogStatus status,
        Integer httpStatus,
        Integer latencyMs,
        String provider,
        String requestedModel,
        String usedModel,
        boolean isFailover,
        Integer inputTokens,
        Integer outputTokens,
        Integer totalTokens,
        String promptKey,
        boolean ragEnabled,
        Integer ragLatencyMs,
        Integer ragChunksCount,
        String errorCode,
        String errorMessage,
        String failReason,
        LocalDateTime createdAt,
        LocalDateTime finishedAt,
        String requestPayload,
        String responsePayload,
        String requestSource,
        List<RetrievedDocumentResponse> retrievedDocuments) {

    public static RequestLogResponse from(RequestLog log) {
        return fromDetail(log);
    }

    /**
     * 상세 조회 응답 변환
     */
    public static RequestLogResponse fromDetail(RequestLog log) {
        List<RetrievedDocumentResponse> docs = log.getRetrievedDocuments() != null
                ? log.getRetrievedDocuments().stream()
                        .map(RetrievedDocumentResponse::from)
                        .toList()
                : List.of();

        return from(log, docs);
    }

    /**
     * 목록 조회 응답 변환 (N+1 방지를 위해 retrievedDocuments는 비워서 응답)
     */
    public static RequestLogResponse fromSummary(RequestLog log) {
        return from(log, List.of());
    }

    private static RequestLogResponse from(RequestLog log, List<RetrievedDocumentResponse> docs) {
        return new RequestLogResponse(
                log.getRequestId(),
                log.getTraceId(),
                log.getStatus(),
                log.getHttpStatus(),
                log.getLatencyMs(),
                log.getProvider(),
                log.getRequestedModel(),
                log.getUsedModel(),
                log.isFailover(),
                log.getInputTokens(),
                log.getOutputTokens(),
                log.getTotalTokens(),
                log.getPromptKey(),
                log.isRagEnabled(),
                log.getRagLatencyMs(),
                log.getRagChunksCount(),
                log.getErrorCode(),
                log.getErrorMessage(),
                log.getFailReason(),
                log.getCreatedAt(),
                log.getFinishedAt(),
                log.getRequestPayload(),
                log.getResponsePayload(),
                log.getRequestSource(),
                docs);
    }
}
