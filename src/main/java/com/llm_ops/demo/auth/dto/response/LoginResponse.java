package com.llm_ops.demo.auth.dto.response;

public record LoginResponse(
                String accessToken,
                String refreshToken,
                String tokenType,
                long expiresInSec,
                long refreshExpiresInSec) {
}
