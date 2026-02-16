package com.llm_ops.demo.global.handler;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.global.error.ErrorResponse;
import com.llm_ops.demo.global.error.GatewayException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.core.MethodParameter;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.validation.method.ParameterErrors;
import org.springframework.validation.method.ParameterValidationResult;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private static final String GATEWAY_CHAT_PATH = "/v1/chat";
    private static final Pattern SENSITIVE_KEY_VALUE_PATTERN = Pattern.compile(
            "(?i)(api[_-]?key|authorization|token|secret|password)\\s*[:=]\\s*(?:bearer\\s+)?[^\\s,;]+"
    );
    private static final Pattern SENSITIVE_BEARER_PATTERN = Pattern.compile(
            "(?i)\\bbearer\\s+[^\\s,;]+"
    );

    @ExceptionHandler(GatewayException.class)
    public ResponseEntity<ErrorResponse> handleGatewayException(GatewayException e) {
        String message = sanitizeMessage(e.getMessage(), "게이트웨이 요청 처리 중 오류가 발생했습니다.");
        return ResponseEntity
                .status(e.getStatus())
                .body(ErrorResponse.of(e.getCode(), message));
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusinessException(BusinessException e, HttpServletRequest request) {
        if (isGatewayPath(request)) {
            GatewayBusinessMapping mapping = mapGatewayBusiness(e);
            return ResponseEntity
                    .status(mapping.status())
                    .body(ErrorResponse.of(
                            mapping.code(),
                            sanitizeMessage(mapping.message(), "게이트웨이 요청 처리 중 오류가 발생했습니다.")
                    ));
        }

        ErrorCode errorCode = e.getErrorCode();
        return ResponseEntity
                .status(errorCode.getStatus())
                .body(ErrorResponse.of(errorCode, sanitizeMessage(e.getMessage(), errorCode.getDefaultMessage())));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationException(MethodArgumentNotValidException e) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (FieldError fe : e.getBindingResult().getFieldErrors()) {
            fieldErrors.put(fe.getField(), fe.getDefaultMessage());
        }

        return ResponseEntity
                .status(ErrorCode.INVALID_INPUT_VALUE.getStatus())
                .body(ErrorResponse.ofValidation(ErrorCode.INVALID_INPUT_VALUE, fieldErrors));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(ConstraintViolationException e) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (ConstraintViolation<?> violation : e.getConstraintViolations()) {
            String field = extractFieldName(violation.getPropertyPath().toString());
            fieldErrors.put(field, violation.getMessage());
        }

        return ResponseEntity
                .status(ErrorCode.INVALID_INPUT_VALUE.getStatus())
                .body(ErrorResponse.ofValidation(ErrorCode.INVALID_INPUT_VALUE, fieldErrors));
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ErrorResponse> handleHandlerMethodValidation(HandlerMethodValidationException e) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();

        for (ParameterValidationResult result : e.getParameterValidationResults()) {
            if (result instanceof ParameterErrors errors) {
                for (FieldError fe : errors.getFieldErrors()) {
                    fieldErrors.put(fe.getField(), fe.getDefaultMessage());
                }
                continue;
            }

            String field = resolveParameterName(result);
            String message = extractMessage(result);
            if (field != null && message != null) {
                fieldErrors.put(field, message);
            }
        }

        if (fieldErrors.isEmpty()) {
            return ResponseEntity
                    .status(ErrorCode.INVALID_INPUT_VALUE.getStatus())
                    .body(ErrorResponse.of(ErrorCode.INVALID_INPUT_VALUE, "요청 값이 올바르지 않습니다."));
        }

        return ResponseEntity
                .status(ErrorCode.INVALID_INPUT_VALUE.getStatus())
                .body(ErrorResponse.ofValidation(ErrorCode.INVALID_INPUT_VALUE, fieldErrors));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        return ResponseEntity
                .status(ErrorCode.INVALID_INPUT_VALUE.getStatus())
                .body(ErrorResponse.of(ErrorCode.INVALID_INPUT_VALUE, "요청 파라미터 타입이 올바르지 않습니다."));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleNotReadable(HttpMessageNotReadableException e) {
        return ResponseEntity
                .status(ErrorCode.INVALID_INPUT_VALUE.getStatus())
                .body(ErrorResponse.of(ErrorCode.INVALID_INPUT_VALUE, "요청 본문이 올바르지 않습니다."));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotSupported(HttpRequestMethodNotSupportedException e) {
        return ResponseEntity
                .status(ErrorCode.METHOD_NOT_ALLOWED.getStatus())
                .body(ErrorResponse.of(ErrorCode.METHOD_NOT_ALLOWED, null));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleException(Exception e) {
        log.error("Unhandled exception", e);
        return ResponseEntity
                .status(ErrorCode.INTERNAL_SERVER_ERROR.getStatus())
                .body(ErrorResponse.of(ErrorCode.INTERNAL_SERVER_ERROR, null));
    }

    private String resolveParameterName(ParameterValidationResult result) {
        MethodParameter param = result.getMethodParameter();
        RequestParam requestParam = param.getParameterAnnotation(RequestParam.class);
        if (requestParam != null) {
            String name = requestParam.name();
            if (name == null || name.isBlank()) {
                name = requestParam.value();
            }
            if (name != null && !name.isBlank()) {
                return name;
            }
        }
        String parameterName = param.getParameterName();
        return parameterName != null ? parameterName : "parameter";
    }

    private String extractMessage(ParameterValidationResult result) {
        if (result.getResolvableErrors().isEmpty()) {
            return null;
        }
        return result.getResolvableErrors().get(0).getDefaultMessage();
    }

    private String extractFieldName(String propertyPath) {
        int lastDot = propertyPath.lastIndexOf('.');
        if (lastDot >= 0 && lastDot < propertyPath.length() - 1) {
            return propertyPath.substring(lastDot + 1);
        }
        return propertyPath.isBlank() ? "parameter" : propertyPath;
    }

    private boolean isGatewayPath(HttpServletRequest request) {
        return request != null && request.getRequestURI() != null && request.getRequestURI().startsWith(GATEWAY_CHAT_PATH);
    }

    private GatewayBusinessMapping mapGatewayBusiness(BusinessException e) {
        ErrorCode errorCode = e.getErrorCode();
        return switch (errorCode) {
            case UNAUTHENTICATED -> new GatewayBusinessMapping("GW-REQ-UNAUTHORIZED", HttpStatus.UNAUTHORIZED, e.getMessage());
            case FORBIDDEN -> new GatewayBusinessMapping("GW-REQ-FORBIDDEN", HttpStatus.FORBIDDEN, e.getMessage());
            case BUDGET_EXCEEDED -> new GatewayBusinessMapping("GW-REQ-QUOTA_EXCEEDED", HttpStatus.TOO_MANY_REQUESTS, e.getMessage());
            case INVALID_INPUT_VALUE, METHOD_NOT_ALLOWED, CONFLICT, NOT_FOUND ->
                    new GatewayBusinessMapping("GW-REQ-INVALID_REQUEST", HttpStatus.BAD_REQUEST, e.getMessage());
            default -> new GatewayBusinessMapping("GW-GW-POLICY_BLOCKED", errorCode.getStatus(), e.getMessage());
        };
    }

    private String sanitizeMessage(String message, String fallback) {
        String candidate = message;
        if (candidate == null || candidate.isBlank()) {
            candidate = fallback;
        }
        String sanitized = SENSITIVE_KEY_VALUE_PATTERN.matcher(candidate).replaceAll("$1=[REDACTED]");
        sanitized = SENSITIVE_BEARER_PATTERN.matcher(sanitized).replaceAll("Bearer [REDACTED]");
        if (sanitized.length() > 300) {
            return sanitized.substring(0, 300);
        }
        return sanitized;
    }

    private record GatewayBusinessMapping(String code, HttpStatus status, String message) {
    }
}
