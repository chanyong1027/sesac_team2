package com.llm_ops.demo.eval.config;

import com.llm_ops.demo.gateway.service.GatewayFailureClassifier;
import io.github.resilience4j.common.circuitbreaker.configuration.CircuitBreakerConfigCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Eval 모듈의 Circuit Breaker 실패율 집계를 게이트웨이 장애 정책과 일치시킵니다.
 */
@Configuration
public class EvalCircuitBreakerConfig {

    private static final GatewayFailureClassifier FAILURE_CLASSIFIER = new GatewayFailureClassifier();

    @Bean
    public CircuitBreakerConfigCustomizer evalOpenAiCircuitBreakerCustomizer() {
        return failureOnlyCustomizer("eval-openai");
    }

    @Bean
    public CircuitBreakerConfigCustomizer evalAnthropicCircuitBreakerCustomizer() {
        return failureOnlyCustomizer("eval-anthropic");
    }

    @Bean
    public CircuitBreakerConfigCustomizer evalGeminiCircuitBreakerCustomizer() {
        return failureOnlyCustomizer("eval-gemini");
    }

    private static CircuitBreakerConfigCustomizer failureOnlyCustomizer(String instanceName) {
        return CircuitBreakerConfigCustomizer.of(instanceName, builder ->
                // false는 success로 집계되므로, 비장애 예외는 ignore로 빼서 실패율에서 제외합니다.
                builder.ignoreException(EvalCircuitBreakerConfig::isIgnoredForFailureRate)
        );
    }

    private static boolean isIgnoredForFailureRate(Throwable throwable) {
        Exception exception = throwable instanceof Exception ex
                ? ex
                : new RuntimeException(throwable);
        GatewayFailureClassifier.GatewayFailure failure = FAILURE_CLASSIFIER.classifyProvider(exception);
        return !isCountedFailure(failure);
    }

    private static boolean isCountedFailure(GatewayFailureClassifier.GatewayFailure failure) {
        if (failure == null || failure.errorCode() == null) {
            return false;
        }
        return switch (failure.errorCode()) {
            case "GW-UP-RATE_LIMIT", "GW-UP-TIMEOUT", "GW-UP-UNAVAILABLE" -> true;
            default -> false;
        };
    }
}
