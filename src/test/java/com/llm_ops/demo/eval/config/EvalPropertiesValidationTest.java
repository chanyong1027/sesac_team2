package com.llm_ops.demo.eval.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.context.ConfigurationPropertiesAutoConfiguration;
import org.springframework.boot.autoconfigure.validation.ValidationAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.context.properties.bind.validation.BindValidationException;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

import static org.assertj.core.api.Assertions.assertThat;

class EvalPropertiesValidationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(
                    ConfigurationPropertiesAutoConfiguration.class,
                    ValidationAutoConfiguration.class
            ))
            .withUserConfiguration(TestConfig.class);

    @ParameterizedTest(name = "{0}={1}")
    @CsvSource({
            "eval.worker.max-concurrent-runs, 0",
            "eval.execution.max-concurrent-cases-per-run, 0",
            "eval.worker.claim-batch-size, -1",
            "eval.runner.provider-limits.openai-max-concurrent-calls, 0"
    })
    @DisplayName("양수가 필요한 Eval 설정값이 0 이하이면 context 초기화에 실패한다")
    void 양수가_필요한_Eval_설정값이_0_이하이면_context_초기화에_실패한다(String propertyName, String propertyValue) {
        // given
        ApplicationContextRunner runner = contextRunner.withPropertyValues(propertyName + "=" + propertyValue);

        // when // then
        runner.run(context -> {
            assertThat(context.getStartupFailure()).isNotNull();
            assertThat(context.getStartupFailure()).hasRootCauseInstanceOf(BindValidationException.class);
        });
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(EvalProperties.class)
    static class TestConfig {
    }
}
