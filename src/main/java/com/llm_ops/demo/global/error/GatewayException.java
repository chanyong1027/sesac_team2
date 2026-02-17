package com.llm_ops.demo.global.error;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class GatewayException extends RuntimeException {

    private final String code;
    private final HttpStatus status;

    public GatewayException(String code, HttpStatus status, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
        this.status = status;
    }
}
