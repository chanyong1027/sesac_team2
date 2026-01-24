package com.llm_ops.demo.auth.dto.request;

import jakarta.validation.constraints.NotBlank;

public record TokenRefreshRequest(
        @NotBlank(message = "Refresh token은 필수입니다.") String refreshToken) {
}
