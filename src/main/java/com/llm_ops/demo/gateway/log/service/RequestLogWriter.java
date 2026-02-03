package com.llm_ops.demo.gateway.log.service;

import com.llm_ops.demo.gateway.log.domain.RequestLog;
import com.llm_ops.demo.gateway.log.repository.RequestLogRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RequestLogWriter {

    private final RequestLogRepository requestLogRepository;
    private final Clock clock = Clock.systemUTC();

    public RequestLogWriter(RequestLogRepository requestLogRepository) {
        this.requestLogRepository = requestLogRepository;
    }

    @Transactional
    public UUID start(StartRequest request) {
        UUID requestId = request.requestId() != null ? request.requestId() : UUID.randomUUID();
        RequestLog requestLog = RequestLog.loggingStart(
                requestId,
                request.traceId(),
                request.organizationId(),
                request.workspaceId(),
                request.apiKeyId(),
                request.apiKeyPrefix(),
                request.requestPath(),
                request.httpMethod(),
                request.promptKey(),
                request.ragEnabled()
        );
        requestLogRepository.save(requestLog);
        return requestId;
    }

    @Transactional
    public void markSuccess(UUID requestId, SuccessUpdate update) {
        RequestLog requestLog = requestLogRepository.findById(requestId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "request log not found: " + requestId));
        requestLog.fillModelUsage(
                update.provider(),
                update.requestedModel(),
                update.usedModel(),
                update.isFailover(),
                update.inputTokens(),
                update.outputTokens(),
                update.totalTokens()
        );
        requestLog.fillCost(
                update.estimatedCost(),
                update.currency(),
                update.pricingVersion()
        );
        requestLog.fillRagMetrics(
                update.ragTopK(),
                update.ragSimilarityThreshold(),
                update.ragLatencyMs(),
                update.ragChunksCount(),
                update.ragContextChars(),
                update.ragContextTruncated(),
                update.ragContextHash()
        );
        requestLog.markSuccess(LocalDateTime.now(clock), update.httpStatus(), update.latencyMs());
    }

    @Transactional
    public void markFail(UUID requestId, FailUpdate update) {
        RequestLog requestLog = requestLogRepository.findById(requestId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "request log not found: " + requestId));
        requestLog.fillModelUsage(
                update.provider(),
                update.requestedModel(),
                update.usedModel(),
                update.isFailover(),
                update.inputTokens(),
                update.outputTokens(),
                update.totalTokens()
        );
        requestLog.fillCost(
                update.estimatedCost(),
                update.currency(),
                update.pricingVersion()
        );
        requestLog.fillRagMetrics(
                update.ragTopK(),
                update.ragSimilarityThreshold(),
                update.ragLatencyMs(),
                update.ragChunksCount(),
                update.ragContextChars(),
                update.ragContextTruncated(),
                update.ragContextHash()
        );
        requestLog.markFail(
                LocalDateTime.now(clock),
                update.httpStatus(),
                update.latencyMs(),
                update.errorCode(),
                update.errorMessage(),
                update.failReason()
        );
    }

    public record StartRequest(
            UUID requestId,
            String traceId,
            Long organizationId,
            Long workspaceId,
            Long apiKeyId,
            String apiKeyPrefix,
            String requestPath,
            String httpMethod,
            String promptKey,
            boolean ragEnabled
    ) {
    }

    public record SuccessUpdate(
            Integer httpStatus,
            Integer latencyMs,
            String provider,
            String requestedModel,
            String usedModel,
            boolean isFailover,
            Integer inputTokens,
            Integer outputTokens,
            Integer totalTokens,
            java.math.BigDecimal estimatedCost,
            String currency,
            String pricingVersion,
            Integer ragTopK,
            Double ragSimilarityThreshold,
            Integer ragLatencyMs,
            Integer ragChunksCount,
            Integer ragContextChars,
            Boolean ragContextTruncated,
            String ragContextHash
    ) {
    }

    public record FailUpdate(
            Integer httpStatus,
            Integer latencyMs,
            String provider,
            String requestedModel,
            String usedModel,
            boolean isFailover,
            Integer inputTokens,
            Integer outputTokens,
            Integer totalTokens,
            String errorCode,
            String errorMessage,
            String failReason,
            java.math.BigDecimal estimatedCost,
            String currency,
            String pricingVersion,
            Integer ragTopK,
            Double ragSimilarityThreshold,
            Integer ragLatencyMs,
            Integer ragChunksCount,
            Integer ragContextChars,
            Boolean ragContextTruncated,
            String ragContextHash
    ) {
    }
}
