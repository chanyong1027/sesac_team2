package com.llm_ops.demo.gateway.service;

import com.google.genai.errors.ApiException;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import java.io.InterruptedIOException;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.util.concurrent.TimeoutException;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;

/**
 * 게이트웨이 표준 에러코드와 failover/retry 정책을 예외로부터 분류합니다.
 */
public final class GatewayFailureClassifier {

    public enum FailoverPolicy {
        FAIL_FAST,
        IMMEDIATE_FAILOVER,
        RETRY_ONCE_THEN_FAILOVER
    }

    public record GatewayFailure(
            String errorCode,
            String failReason,
            String errorMessage,
            int httpStatus,
            FailoverPolicy policy
    ) {
        public boolean failoverEligible() {
            return policy == FailoverPolicy.IMMEDIATE_FAILOVER
                    || policy == FailoverPolicy.RETRY_ONCE_THEN_FAILOVER;
        }

        public boolean retrySameRouteOnce() {
            return policy == FailoverPolicy.RETRY_ONCE_THEN_FAILOVER;
        }
    }

    public GatewayFailure classifyProvider(Exception exception) {
        Throwable current = exception;
        while (current != null) {
            if (current instanceof ApiException apiException) {
                GatewayFailure mapped = classifyGeminiApiException(apiException);
                if (mapped != null) {
                    return mapped;
                }
            }
            if (current instanceof HttpStatusCodeException statusException) {
                return classifyHttpStatusException(statusException);
            }
            if (current instanceof SocketTimeoutException) {
                return timeout("SOCKET_TIMEOUT");
            }
            if (current instanceof InterruptedIOException) {
                return timeout("INTERRUPTED_IO");
            }
            if (current instanceof TimeoutException) {
                return timeout("TIMEOUT_EXCEPTION");
            }
            if (current instanceof ConnectException) {
                return unavailable("CONNECT_EXCEPTION");
            }
            if (current instanceof UnknownHostException) {
                return unavailable("UNKNOWN_HOST");
            }
            if (current instanceof ResourceAccessException) {
                return unavailable("RESOURCE_ACCESS");
            }
            current = current.getCause();
        }
        return unavailable("UPSTREAM_EXCEPTION");
    }

    public GatewayFailure classifyBusiness(BusinessException exception, String overrideReason) {
        ErrorCode errorCode = exception.getErrorCode();
        String failReason = overrideReason != null && !overrideReason.isBlank()
                ? overrideReason
                : errorCode.name();
        return switch (errorCode) {
            case UNAUTHENTICATED -> new GatewayFailure(
                    "GW-REQ-UNAUTHORIZED",
                    failReason,
                    exception.getMessage(),
                    HttpStatus.UNAUTHORIZED.value(),
                    FailoverPolicy.FAIL_FAST
            );
            case FORBIDDEN -> new GatewayFailure(
                    "GW-REQ-FORBIDDEN",
                    failReason,
                    exception.getMessage(),
                    HttpStatus.FORBIDDEN.value(),
                    FailoverPolicy.FAIL_FAST
            );
            case BUDGET_EXCEEDED -> new GatewayFailure(
                    "GW-REQ-QUOTA_EXCEEDED",
                    failReason,
                    exception.getMessage(),
                    HttpStatus.TOO_MANY_REQUESTS.value(),
                    FailoverPolicy.FAIL_FAST
            );
            case INVALID_INPUT_VALUE, METHOD_NOT_ALLOWED, CONFLICT, NOT_FOUND -> new GatewayFailure(
                    "GW-REQ-INVALID_REQUEST",
                    failReason,
                    exception.getMessage(),
                    HttpStatus.BAD_REQUEST.value(),
                    FailoverPolicy.FAIL_FAST
            );
            default -> new GatewayFailure(
                    "GW-GW-POLICY_BLOCKED",
                    failReason,
                    exception.getMessage(),
                    errorCode.getStatus().value(),
                    FailoverPolicy.FAIL_FAST
            );
        };
    }

    public GatewayFailure requestDeadlineExceededFailure() {
        return timeout("REQUEST_DEADLINE_EXCEEDED");
    }

    public GatewayFailure requestDeadlineExhaustedFailure() {
        return new GatewayFailure(
                "GW-UP-TIMEOUT",
                "REQUEST_DEADLINE_EXCEEDED",
                "요청 전체 처리 시간 한도를 초과했습니다.",
                HttpStatus.GATEWAY_TIMEOUT.value(),
                FailoverPolicy.FAIL_FAST
        );
    }

    private GatewayFailure classifyGeminiApiException(ApiException apiException) {
        int code = apiException.code();
        String status = apiException.status();
        if (code == 429 || containsAny(status, "RESOURCE_EXHAUSTED")) {
            return new GatewayFailure(
                    "GW-UP-RATE_LIMIT",
                    "RESOURCE_EXHAUSTED",
                    "업스트림 요청 제한으로 failover를 시도합니다.",
                    HttpStatus.TOO_MANY_REQUESTS.value(),
                    FailoverPolicy.IMMEDIATE_FAILOVER
            );
        }
        if (code == 404 || containsAny(status, "NOT_FOUND")) {
            return new GatewayFailure(
                    "GW-UP-MODEL_NOT_FOUND",
                    "MODEL_404",
                    "요청 모델을 찾을 수 없어 failover를 시도합니다.",
                    HttpStatus.BAD_GATEWAY.value(),
                    FailoverPolicy.IMMEDIATE_FAILOVER
            );
        }
        if (code == 408 || containsAny(status, "DEADLINE_EXCEEDED", "TIMEOUT")) {
            return timeout("DEADLINE_EXCEEDED");
        }
        if (code >= 500 || containsAny(status, "UNAVAILABLE")) {
            return unavailable("UPSTREAM_UNAVAILABLE");
        }
        if (code >= 400 && code < 500) {
            return new GatewayFailure(
                    "GW-REQ-INVALID_REQUEST",
                    "UPSTREAM_4XX",
                    "요청이 업스트림 정책과 맞지 않습니다.",
                    HttpStatus.BAD_REQUEST.value(),
                    FailoverPolicy.FAIL_FAST
            );
        }
        return null;
    }

    private GatewayFailure classifyHttpStatusException(HttpStatusCodeException statusException) {
        int status = statusException.getStatusCode().value();
        if (status == 429) {
            return new GatewayFailure(
                    "GW-UP-RATE_LIMIT",
                    "HTTP_429",
                    "업스트림 요청 제한으로 failover를 시도합니다.",
                    HttpStatus.TOO_MANY_REQUESTS.value(),
                    FailoverPolicy.IMMEDIATE_FAILOVER
            );
        }
        if (status == 404) {
            return new GatewayFailure(
                    "GW-UP-MODEL_NOT_FOUND",
                    "MODEL_404",
                    "요청 모델을 찾을 수 없어 failover를 시도합니다.",
                    HttpStatus.BAD_GATEWAY.value(),
                    FailoverPolicy.IMMEDIATE_FAILOVER
            );
        }
        if (status == 408 || status == 504) {
            return timeout("HTTP_" + status);
        }
        if (status >= 500) {
            return unavailable("HTTP_" + status);
        }
        return new GatewayFailure(
                "GW-REQ-INVALID_REQUEST",
                "HTTP_" + status,
                "요청이 유효하지 않습니다.",
                HttpStatus.BAD_REQUEST.value(),
                FailoverPolicy.FAIL_FAST
        );
    }

    private GatewayFailure timeout(String failReason) {
        return new GatewayFailure(
                "GW-UP-TIMEOUT",
                failReason,
                "업스트림 타임아웃이 발생해 재시도 후 failover를 시도합니다.",
                HttpStatus.GATEWAY_TIMEOUT.value(),
                FailoverPolicy.RETRY_ONCE_THEN_FAILOVER
        );
    }

    private GatewayFailure unavailable(String failReason) {
        return new GatewayFailure(
                "GW-UP-UNAVAILABLE",
                failReason,
                "업스트림 일시 장애로 재시도 후 failover를 시도합니다.",
                HttpStatus.BAD_GATEWAY.value(),
                FailoverPolicy.RETRY_ONCE_THEN_FAILOVER
        );
    }

    private boolean containsAny(String source, String... keywords) {
        if (source == null || source.isBlank()) {
            return false;
        }
        for (String keyword : keywords) {
            if (source.contains(keyword)) {
                return true;
            }
        }
        return false;
    }
}
