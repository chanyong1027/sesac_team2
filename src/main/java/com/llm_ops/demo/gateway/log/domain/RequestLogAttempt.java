package com.llm_ops.demo.gateway.log.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Getter
@Table(name = "request_log_attempts")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RequestLogAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "request_id", nullable = false)
    private RequestLog requestLog;

    @Column(name = "attempt_no", nullable = false)
    private Integer attemptNo;

    @Enumerated(EnumType.STRING)
    @Column(name = "route", nullable = false, length = 16)
    private RequestLogAttemptRoute route;

    @Column(name = "retry", nullable = false)
    private boolean retry;

    @Enumerated(EnumType.STRING)
    @Column(name = "result", nullable = false, length = 16)
    private RequestLogAttemptResult result;

    @Column(name = "provider", length = 32)
    private String provider;

    @Column(name = "requested_model", length = 128)
    private String requestedModel;

    @Column(name = "used_model", length = 128)
    private String usedModel;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "ended_at", nullable = false)
    private LocalDateTime endedAt;

    @Column(name = "latency_ms", nullable = false)
    private Integer latencyMs;

    @Column(name = "http_status")
    private Integer httpStatus;

    @Column(name = "error_code", length = 64)
    private String errorCode;

    @Column(name = "fail_reason", length = 64)
    private String failReason;

    @Column(name = "error_message")
    private String errorMessage;

    @Column(name = "backoff_after_ms")
    private Integer backoffAfterMs;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public static RequestLogAttempt create(
            RequestLog requestLog,
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
        RequestLogAttempt attempt = new RequestLogAttempt();
        attempt.requestLog = requestLog;
        attempt.attemptNo = attemptNo;
        attempt.route = route;
        attempt.retry = retry;
        attempt.result = result;
        attempt.provider = provider;
        attempt.requestedModel = requestedModel;
        attempt.usedModel = usedModel;
        attempt.startedAt = startedAt;
        attempt.endedAt = endedAt;
        attempt.latencyMs = latencyMs != null ? Math.max(0, latencyMs) : 0;
        attempt.httpStatus = httpStatus;
        attempt.errorCode = errorCode;
        attempt.failReason = failReason;
        attempt.errorMessage = errorMessage;
        attempt.backoffAfterMs = backoffAfterMs != null && backoffAfterMs > 0 ? backoffAfterMs : null;
        return attempt;
    }
}

