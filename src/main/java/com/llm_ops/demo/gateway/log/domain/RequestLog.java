package com.llm_ops.demo.gateway.log.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Getter
@Table(name = "request_logs")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RequestLog {

    @Id
    @Column(name = "request_id", nullable = false)
    private UUID requestId;

    @Column(name = "trace_id", nullable = false, length = 64)
    private String traceId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "finished_at")
    private LocalDateTime finishedAt;

    @Column(name = "latency_ms")
    private Integer latencyMs;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "workspace_id", nullable = false)
    private Long workspaceId;

    @Column(name = "api_key_id")
    private Long apiKeyId;

    @Column(name = "api_key_prefix", length = 16)
    private String apiKeyPrefix;

    @Column(name = "request_path", nullable = false, length = 128)
    private String requestPath;

    @Column(name = "http_method", nullable = false, length = 8)
    private String httpMethod;

    @Column(name = "http_status")
    private Integer httpStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private RequestLogStatus status;

    @Column(name = "error_code", length = 64)
    private String errorCode;

    @Column(name = "error_message")
    private String errorMessage;

    @Column(name = "fail_reason", length = 64)
    private String failReason;

    @Column(name = "prompt_key", nullable = false, length = 128)
    private String promptKey;

    @Column(name = "prompt_id")
    private Long promptId;

    @Column(name = "prompt_version_id")
    private Long promptVersionId;

    @Column(name = "requested_model", length = 128)
    private String requestedModel;

    @Column(name = "used_model", length = 128)
    private String usedModel;

    @Column(name = "provider", length = 32)
    private String provider;

    @Column(name = "is_failover", nullable = false)
    private boolean isFailover;

    @Column(name = "input_tokens")
    private Integer inputTokens;

    @Column(name = "output_tokens")
    private Integer outputTokens;

    @Column(name = "total_tokens")
    private Integer totalTokens;

    @Column(name = "estimated_cost", precision = 18, scale = 8)
    private BigDecimal estimatedCost;

    @Column(name = "currency", length = 3)
    private String currency;

    @Column(name = "pricing_version", length = 64)
    private String pricingVersion;

    @Column(name = "rag_enabled", nullable = false)
    private boolean ragEnabled;

    @Column(name = "rag_top_k")
    private Integer ragTopK;

    @Column(name = "rag_similarity_threshold")
    private Double ragSimilarityThreshold;

    public RequestLogStatus getStatus() {
        return status;
    }

    public Integer getHttpStatus() {
        return httpStatus;
    }

    public Integer getLatencyMs() {
        return latencyMs;
    }

    public LocalDateTime getFinishedAt() {
        return finishedAt;
    }

    public Long getApiKeyId() {
        return apiKeyId;
    }

    public String getApiKeyPrefix() {
        return apiKeyPrefix;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public String getFailReason() {
        return failReason;
    }

    public String getProvider() {
        return provider;
    }

    public Integer getTotalTokens() {
        return totalTokens;
    }

    public Integer getRagLatencyMs() {
        return ragLatencyMs;
    }

    public Integer getRagChunksCount() {
        return ragChunksCount;
    }

    public Integer getRagContextChars() {
        return ragContextChars;
    }

    public Boolean getRagContextTruncated() {
        return ragContextTruncated;
    }

    public String getRagContextHash() {
        return ragContextHash;
    }

    public BigDecimal getEstimatedCost() {
        return estimatedCost;
    }

    @Column(name = "rag_latency_ms")
    private Integer ragLatencyMs;

    @Column(name = "rag_chunks_count")
    private Integer ragChunksCount;

    @Column(name = "rag_context_chars")
    private Integer ragContextChars;

    @Column(name = "rag_context_truncated")
    private Boolean ragContextTruncated;

    @Column(name = "rag_context_hash", length = 64)
    private String ragContextHash;

    public static RequestLog loggingStart(
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
        RequestLog requestLog = new RequestLog();
        requestLog.requestId = requestId;
        requestLog.traceId = traceId;
        requestLog.organizationId = organizationId;
        requestLog.workspaceId = workspaceId;
        requestLog.apiKeyId = apiKeyId;
        requestLog.apiKeyPrefix = apiKeyPrefix;
        requestLog.requestPath = requestPath;
        requestLog.httpMethod = httpMethod;
        requestLog.promptKey = promptKey;
        requestLog.ragEnabled = ragEnabled;
        requestLog.status = RequestLogStatus.IN_PROGRESS;
        requestLog.currency = "USD";
        return requestLog;
    }

    public void markSuccess(LocalDateTime finishedAt, Integer httpStatus, Integer latencyMs) {
        if (this.status == RequestLogStatus.SUCCESS || this.status == RequestLogStatus.FAIL) {
            return;
        }
        this.status = RequestLogStatus.SUCCESS;
        this.finishedAt = finishedAt;
        this.httpStatus = httpStatus;
        this.latencyMs = latencyMs;
    }

    public void markFail(LocalDateTime finishedAt, Integer httpStatus, Integer latencyMs, String errorCode, String errorMessage, String failReason) {
        if (this.status == RequestLogStatus.SUCCESS || this.status == RequestLogStatus.FAIL) {
            return;
        }
        this.status = RequestLogStatus.FAIL;
        this.finishedAt = finishedAt;
        this.httpStatus = httpStatus;
        this.latencyMs = latencyMs;
        this.errorCode = errorCode;
        this.errorMessage = errorMessage;
        this.failReason = failReason;
    }

    public void fillModelUsage(String provider, String requestedModel, String usedModel, boolean isFailover, Integer inputTokens, Integer outputTokens, Integer totalTokens) {
        this.provider = provider;
        this.requestedModel = requestedModel;
        this.usedModel = usedModel;
        this.isFailover = isFailover;
        this.inputTokens = inputTokens;
        this.outputTokens = outputTokens;
        this.totalTokens = totalTokens;
    }

    public void fillRagMetrics(
            Integer ragTopK,
            Double ragSimilarityThreshold,
            Integer ragLatencyMs,
            Integer ragChunksCount,
            Integer ragContextChars,
            Boolean ragContextTruncated,
            String ragContextHash
    ) {
        this.ragTopK = ragTopK;
        this.ragSimilarityThreshold = ragSimilarityThreshold;
        this.ragLatencyMs = ragLatencyMs;
        this.ragChunksCount = ragChunksCount;
        this.ragContextChars = ragContextChars;
        this.ragContextTruncated = ragContextTruncated;
        this.ragContextHash = ragContextHash;
    }

    public void fillCost(BigDecimal estimatedCost, String currency, String pricingVersion) {
        this.estimatedCost = estimatedCost;
        if (currency != null && !currency.isBlank()) {
            this.currency = currency;
        }
        this.pricingVersion = pricingVersion;
    }
}
