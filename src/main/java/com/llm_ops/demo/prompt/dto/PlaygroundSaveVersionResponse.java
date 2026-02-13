package com.llm_ops.demo.prompt.dto;

public record PlaygroundSaveVersionResponse(
    PromptVersionCreateResponse version,
    boolean released
) {}
