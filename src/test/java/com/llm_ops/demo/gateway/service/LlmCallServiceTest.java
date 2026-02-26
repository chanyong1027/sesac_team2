package com.llm_ops.demo.gateway.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.openai.OpenAiChatOptions;

import java.util.Arrays;
import java.lang.reflect.Method;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class LlmCallServiceTest {

    @Test
    @DisplayName("maxTokens 적용 시 토큰 필드는 하나만 설정된다")
    void maxTokens_적용_시_토큰_필드는_하나만_설정된다() {
        // given
        FakeChatOptions options = new FakeChatOptions();
        options.setMaxTokens(11);
        options.setMaxOutputTokens(22);
        options.setMaxCompletionTokens(33);
        LlmCallService.ModelConfigOverride config =
                new LlmCallService.ModelConfigOverride(null, 64, null, null);

        // when
        LlmCallService.applyModelConfig(options, config);

        // then
        assertThat(options.maxTokens).isEqualTo(64);
        assertThat(options.maxOutputTokens).isNull();
        assertThat(options.maxCompletionTokens).isNull();
    }

    @Test
    @DisplayName("maxTokens가 없으면 토큰 필드를 초기화하지 않는다")
    void maxTokens_없으면_토큰_필드를_초기화하지_않는다() {
        // given
        FakeChatOptions options = new FakeChatOptions();
        options.setMaxTokens(11);
        options.setMaxOutputTokens(22);
        options.setMaxCompletionTokens(33);
        LlmCallService.ModelConfigOverride config =
                new LlmCallService.ModelConfigOverride(0.2, null, 0.8, 0.1);

        // when
        LlmCallService.applyModelConfig(options, config);

        // then
        assertThat(options.maxTokens).isEqualTo(11);
        assertThat(options.maxOutputTokens).isEqualTo(22);
        assertThat(options.maxCompletionTokens).isEqualTo(33);
        assertThat(options.temperature).isEqualTo(0.2);
        assertThat(options.topP).isEqualTo(0.8);
        assertThat(options.frequencyPenalty).isEqualTo(0.1);
    }

    @Test
    @DisplayName("OpenAI 옵션에도 max token 필드는 하나만 유지된다")
    void OpenAI_옵션_토큰_필드_충돌을_방지한다() {
        // given
        OpenAiChatOptions options = OpenAiChatOptions.builder().build();
        LlmCallService.ModelConfigOverride config =
                new LlmCallService.ModelConfigOverride(null, 48, null, null);

        // when
        LlmCallService.applyModelConfig(options, config);

        // then
        Integer maxTokens = invokeIntegerGetter(options, "getMaxTokens");
        Integer maxOutputTokens = invokeIntegerGetter(options, "getMaxOutputTokens");
        Integer maxCompletionTokens = invokeIntegerGetter(options, "getMaxCompletionTokens");

        List<Integer> configured = Arrays.asList(maxTokens, maxOutputTokens, maxCompletionTokens).stream()
                .filter(v -> v != null)
                .toList();

        assertThat(configured).hasSize(1);
        assertThat(configured.get(0)).isEqualTo(48);
    }

    private static Integer invokeIntegerGetter(Object target, String methodName) {
        try {
            Method method = target.getClass().getMethod(methodName);
            Object value = method.invoke(target);
            if (value instanceof Integer integerValue) {
                return integerValue;
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private static final class FakeChatOptions {
        private Integer maxTokens;
        private Integer maxOutputTokens;
        private Integer maxCompletionTokens;
        private Double temperature;
        private Double topP;
        private Double frequencyPenalty;

        public void setMaxTokens(Integer maxTokens) {
            this.maxTokens = maxTokens;
        }

        public void setMaxOutputTokens(Integer maxOutputTokens) {
            this.maxOutputTokens = maxOutputTokens;
        }

        public void setMaxCompletionTokens(Integer maxCompletionTokens) {
            this.maxCompletionTokens = maxCompletionTokens;
        }

        public void setTemperature(Double temperature) {
            this.temperature = temperature;
        }

        public void setTopP(Double topP) {
            this.topP = topP;
        }

        public void setFrequencyPenalty(Double frequencyPenalty) {
            this.frequencyPenalty = frequencyPenalty;
        }
    }
}
