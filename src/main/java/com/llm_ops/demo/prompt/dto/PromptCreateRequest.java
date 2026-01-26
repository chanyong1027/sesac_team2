package com.llm_ops.demo.prompt.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record PromptCreateRequest(
    @NotBlank(message = "프롬프트 키는 필수입니다.")
    @Size(max = 100, message = "프롬프트 키는 100자를 초과할 수 없습니다.")
    @Pattern(regexp = "^[a-z0-9-_]+$", message = "프롬프트 키는 소문자, 숫자, 하이픈, 언더스코어만 사용 가능합니다.")
    String promptKey,

    @Size(max = 500, message = "설명은 500자를 초과할 수 없습니다.")
    String description
) {}
