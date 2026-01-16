package com.llm_ops.demo.auth.dto.response;

public record SignUpResponse(
        Long id,
        String email,
        String userName,
        String message
) {
}
