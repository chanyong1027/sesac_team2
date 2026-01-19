package com.llm_ops.demo.keys.domain;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import lombok.Getter;

@Getter
public enum ProviderType {
    OPENAI("openai"),
    ANTHROPIC("anthropic"),
    GEMINI("gemini");

    private final String value;

    ProviderType(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static ProviderType from(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "지원하지 않는 provider 입니다.");
        }

        String normalized = raw.trim().toLowerCase();
        return switch (normalized) {
            case "openai" -> OPENAI;
            case "anthropic", "claude" -> ANTHROPIC;
            case "gemini", "google" -> GEMINI;
            default -> throw new BusinessException(
                    ErrorCode.INVALID_INPUT_VALUE,
                    "지원하지 않는 provider 입니다."
            );
        };
    }
}
