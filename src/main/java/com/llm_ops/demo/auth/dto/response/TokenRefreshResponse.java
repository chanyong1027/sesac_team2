package com.llm_ops.demo.auth.dto.response;

public record TokenRefreshResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresInSec,
        long refreshExpiresInSec) {
}
