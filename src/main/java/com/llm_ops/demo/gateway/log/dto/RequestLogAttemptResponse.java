package com.llm_ops.demo.gateway.log.dto;

import com.llm_ops.demo.gateway.log.domain.RequestLog;
import com.llm_ops.demo.gateway.log.domain.RequestLogAttempt;
import com.llm_ops.demo.gateway.log.domain.RequestLogAttemptResult;
import com.llm_ops.demo.gateway.log.domain.RequestLogAttemptRoute;
import com.llm_ops.demo.gateway.log.domain.RequestLogStatus;
import java.time.LocalDateTime;

public record RequestLogAttemptResponse(
        Integer attemptNo,
        RequestLogAttemptRoute route,
        boolean retry,
        RequestLogAttemptResult result,
        String provider,
        String requestedModel,
        String usedModel,
        LocalDateTime startedAt,
        LocalDateTime endedAt,
        Integer latencyMs,
        Integer httpStatus,
        String errorCode,
        String failReason,
        String errorMessage,
        Integer backoffAfterMs) {

    public static RequestLogAttemptResponse from(RequestLogAttempt attempt) {
        return new RequestLogAttemptResponse(
                attempt.getAttemptNo(),
                attempt.getRoute(),
                attempt.isRetry(),
                attempt.getResult(),
                attempt.getProvider(),
                attempt.getRequestedModel(),
                attempt.getUsedModel(),
                attempt.getStartedAt(),
                attempt.getEndedAt(),
                attempt.getLatencyMs(),
                attempt.getHttpStatus(),
                attempt.getErrorCode(),
                attempt.getFailReason(),
                attempt.getErrorMessage(),
                attempt.getBackoffAfterMs());
    }

    public static RequestLogAttemptResponse derivedSingle(RequestLog log) {
        LocalDateTime startedAt = log.getCreatedAt();
        Integer latencyMs = log.getLatencyMs() != null ? Math.max(0, log.getLatencyMs()) : 0;
        LocalDateTime endedAt = log.getFinishedAt() != null
                ? log.getFinishedAt()
                : (startedAt != null ? startedAt.plusNanos(latencyMs.longValue() * 1_000_000L) : null);
        return new RequestLogAttemptResponse(
                1,
                RequestLogAttemptRoute.PRIMARY,
                false,
                toAttemptResult(log.getStatus(), log.getFailReason(), log.getErrorCode()),
                log.getProvider(),
                log.getRequestedModel(),
                log.getUsedModel(),
                startedAt,
                endedAt,
                latencyMs,
                log.getHttpStatus(),
                log.getErrorCode(),
                log.getFailReason(),
                log.getErrorMessage(),
                null);
    }

    private static RequestLogAttemptResult toAttemptResult(RequestLogStatus status, String failReason, String errorCode) {
        if (status == RequestLogStatus.SUCCESS) {
            return RequestLogAttemptResult.SUCCESS;
        }
        String signal = ((failReason != null ? failReason : "") + " " + (errorCode != null ? errorCode : ""))
                .toUpperCase();
        if (status == RequestLogStatus.TIMEOUT
                || signal.contains("TIMEOUT")
                || signal.contains("DEADLINE_EXCEEDED")
                || signal.contains("GW-UP-TIMEOUT")) {
            return RequestLogAttemptResult.TIMEOUT;
        }
        return RequestLogAttemptResult.FAIL;
    }
}

