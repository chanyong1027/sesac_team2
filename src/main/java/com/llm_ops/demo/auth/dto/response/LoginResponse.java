package com.llm_ops.demo.auth.dto.response;

public record LoginResponse(
        String accessToken,
        String tokenType, //토큰 타입
        long expiresInSec //만료 시간
) { }
