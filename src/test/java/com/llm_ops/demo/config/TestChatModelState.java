package com.llm_ops.demo.config;

import org.springframework.ai.chat.prompt.Prompt;

import java.util.concurrent.atomic.AtomicReference;

public class TestChatModelState {

    private final AtomicReference<Prompt> lastPrompt = new AtomicReference<>();

    public void record(Prompt prompt) {
        lastPrompt.set(prompt);
    }

    public Prompt getLastPrompt() {
        return lastPrompt.get();
    }
}
