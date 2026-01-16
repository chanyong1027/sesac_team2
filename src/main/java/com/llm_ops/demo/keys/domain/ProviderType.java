package com.llm_ops.demo.keys.domain;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;

import java.util.Arrays;

public enum ProviderType {
    OPENAI("openai"),
    GEMINI("gemini");

    private final String value;

    ProviderType(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static ProviderType from(String raw) {
        return Arrays.stream(values())
                .filter(provider -> provider.value.equalsIgnoreCase(raw))
                .findFirst()
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.INVALID_INPUT_VALUE,
                        "지원하지 않는 provider 입니다."
                ));
    }
}
