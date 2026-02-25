package com.llm_ops.demo.config;

import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.DefaultUsage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.util.List;

/**
 * Stub ChatModel for performance testing (Strategy A).
 * Adds a fixed 200ms delay and returns a deterministic response
 * so that gateway overhead can be measured in isolation.
 *
 * Activate with: SPRING_PROFILES_ACTIVE=prod,test-perf
 */
@Configuration
@Profile("test-perf")
public class PerfTestChatModelConfig {

    private static final long SIMULATED_LATENCY_MS = 200;
    private static final String STUB_RESPONSE = "This is a stub response for performance testing.";
    private static final long STUB_PROMPT_TOKENS = 100;
    private static final long STUB_COMPLETION_TOKENS = 50;
    private static final long STUB_TOTAL_TOKENS = 150;

    @Bean(name = "openAiChatModel")
    ChatModel openAiChatModel() {
        return prompt -> {
            try {
                Thread.sleep(SIMULATED_LATENCY_MS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }

            ChatResponseMetadata metadata = ChatResponseMetadata.builder()
                    .keyValue("model", "stub-perf-test")
                    .usage(new DefaultUsage(STUB_PROMPT_TOKENS, STUB_COMPLETION_TOKENS, STUB_TOTAL_TOKENS))
                    .build();

            return new ChatResponse(
                    List.of(new Generation(new AssistantMessage(STUB_RESPONSE))),
                    metadata
            );
        };
    }
}
