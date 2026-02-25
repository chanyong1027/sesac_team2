package com.llm_ops.demo.gateway.config;

import com.llm_ops.demo.gateway.service.GatewayFailureClassifier;
import io.github.resilience4j.common.circuitbreaker.configuration.CircuitBreakerConfigCustomizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Circuit Breaker 실패율 집계를 게이트웨이 장애 정책과 일치시킵니다.
 */
@Configuration
public class GatewayCircuitBreakerConfig {

    private static final Logger log = LoggerFactory.getLogger(GatewayCircuitBreakerConfig.class);
    private static final GatewayFailureClassifier FAILURE_CLASSIFIER = new GatewayFailureClassifier();

    @Bean
    public CircuitBreakerConfigCustomizer openAiCircuitBreakerCustomizer() {
        return failureOnlyCustomizer("openai");
    }

    @Bean
    public CircuitBreakerConfigCustomizer anthropicCircuitBreakerCustomizer() {
        return failureOnlyCustomizer("anthropic");
    }

    @Bean
    public CircuitBreakerConfigCustomizer geminiCircuitBreakerCustomizer() {
        return failureOnlyCustomizer("gemini");
    }

    private static CircuitBreakerConfigCustomizer failureOnlyCustomizer(String instanceName) {
        return CircuitBreakerConfigCustomizer.of(instanceName, builder ->
                // false는 success로 집계되므로, 비장애 예외는 ignore로 빼서 실패율에서 제외합니다.
                builder.ignoreException(GatewayCircuitBreakerConfig::isIgnoredForFailureRate)
        );
    }

    private static boolean isIgnoredForFailureRate(Throwable throwable) {
        Exception exception = throwable instanceof Exception ex
                ? ex
                : new RuntimeException(throwable);
        GatewayFailureClassifier.GatewayFailure failure = FAILURE_CLASSIFIER.classifyProvider(exception);
        if (failure == null) {
            log.warn("Failed to classify provider exception for circuit breaker. class={}, message={}",
                    exception.getClass().getName(),
                    exception.getMessage());
            // Unknown exceptions should be counted as failures (not ignored).
            return false;
        }
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
