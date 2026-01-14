package com.llm_ops.demo.global.error;

import lombok.Getter;

import java.time.LocalDateTime;
import java.util.Map;

@Getter
public class ErrorResponse {

    private final String code;
    private final String message;
    private final LocalDateTime timestamp;
    private final Map<String, String> fieldErrors;

    private ErrorResponse(
            String code,
            String message,
            LocalDateTime timestamp,
            Map<String, String> fieldErrors
    ) {
        this.code = code;
        this.message = message;
        this.timestamp = timestamp;
        this.fieldErrors = fieldErrors;
    }

    public static ErrorResponse of(ErrorCode errorCode, String message) {
        return new ErrorResponse(
                errorCode.getCode(),
                message != null ? message : errorCode.getDefaultMessage(),
                LocalDateTime.now(),
                null
        );
    }

    public static ErrorResponse ofValidation(ErrorCode errorCode, Map<String, String> fieldErrors) {
        return new ErrorResponse(
                errorCode.getCode(),
                errorCode.getDefaultMessage(),
                LocalDateTime.now(),
                fieldErrors
        );
    }

}
