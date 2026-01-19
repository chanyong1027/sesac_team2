package com.llm_ops.demo.config;

import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.util.List;

@Configuration
@Profile("test")
public class TestChatModelConfig {

    @Bean
    TestChatModelState testChatModelState() {
        return new TestChatModelState();
    }

    @Bean
    ChatModel chatModel(TestChatModelState testChatModelState) {
        return prompt -> {
            testChatModelState.record(prompt);
            return new ChatResponse(
                    List.of(new Generation(new AssistantMessage(prompt.getContents())))
            );
        };
    }
}
