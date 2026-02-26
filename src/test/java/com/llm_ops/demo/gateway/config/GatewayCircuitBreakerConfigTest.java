package com.llm_ops.demo.gateway.config;

import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.common.circuitbreaker.configuration.CircuitBreakerConfigCustomizer;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeoutException;

import static org.assertj.core.api.Assertions.assertThat;

class GatewayCircuitBreakerConfigTest {

    private final GatewayCircuitBreakerConfig config = new GatewayCircuitBreakerConfig();

    @Test
    @DisplayName("4xx 요청 오류는 circuit breaker 실패율 집계에서 제외된다")
    void 요청오류_4xx는_집계에서_제외된다() {
        // given
        CircuitBreakerConfig circuitBreakerConfig = apply(config.openAiCircuitBreakerCustomizer());
        HttpClientErrorException badRequest = HttpClientErrorException.create(
                HttpStatusCode.valueOf(400),
                "Bad Request",
                HttpHeaders.EMPTY,
                new byte[0],
                StandardCharsets.UTF_8
        );

        // when
        boolean ignored = circuitBreakerConfig.getIgnoreExceptionPredicate().test(badRequest);

        // then
        assertThat(ignored).isTrue();
    }

    @Test
    @DisplayName("429 제한 오류는 circuit breaker 실패율 집계에 포함된다")
    void 제한오류_429는_집계에_포함된다() {
        // given
        CircuitBreakerConfig circuitBreakerConfig = apply(config.openAiCircuitBreakerCustomizer());
        HttpClientErrorException tooManyRequests = HttpClientErrorException.create(
                HttpStatusCode.valueOf(429),
                "Too Many Requests",
                HttpHeaders.EMPTY,
                new byte[0],
                StandardCharsets.UTF_8
        );

        // when
        boolean ignored = circuitBreakerConfig.getIgnoreExceptionPredicate().test(tooManyRequests);

        // then
        assertThat(ignored).isFalse();
    }

    @Test
    @DisplayName("5xx 장애는 circuit breaker 실패율 집계에 포함된다")
    void 서버장애_5xx는_집계에_포함된다() {
        // given
        CircuitBreakerConfig circuitBreakerConfig = apply(config.anthropicCircuitBreakerCustomizer());
        HttpServerErrorException serviceUnavailable = HttpServerErrorException.create(
                HttpStatusCode.valueOf(503),
                "Service Unavailable",
                HttpHeaders.EMPTY,
                new byte[0],
                StandardCharsets.UTF_8
        );

        // when
        boolean ignored = circuitBreakerConfig.getIgnoreExceptionPredicate().test(serviceUnavailable);

        // then
        assertThat(ignored).isFalse();
    }

    @Test
    @DisplayName("타임아웃/네트워크 오류는 circuit breaker 실패율 집계에 포함된다")
    void 타임아웃_네트워크_오류는_집계에_포함된다() {
        // given
        CircuitBreakerConfig circuitBreakerConfig = apply(config.geminiCircuitBreakerCustomizer());
        TimeoutException timeoutException = new TimeoutException("timeout");
        ResourceAccessException networkException =
                new ResourceAccessException("I/O error", new java.net.ConnectException("Connection refused"));

        // when
        boolean timeoutIgnored = circuitBreakerConfig.getIgnoreExceptionPredicate().test(timeoutException);
        boolean networkIgnored = circuitBreakerConfig.getIgnoreExceptionPredicate().test(networkException);

        // then
        assertThat(timeoutIgnored).isFalse();
        assertThat(networkIgnored).isFalse();
    }

    @Test
    @DisplayName("모델 404는 failover 대상이지만 circuit breaker 실패율 집계에서는 제외된다")
    void 모델404는_집계에서_제외된다() {
        // given
        CircuitBreakerConfig circuitBreakerConfig = apply(config.openAiCircuitBreakerCustomizer());
        HttpClientErrorException notFound = HttpClientErrorException.create(
                HttpStatusCode.valueOf(404),
                "Not Found",
                HttpHeaders.EMPTY,
                new byte[0],
                StandardCharsets.UTF_8
        );

        // when
        boolean ignored = circuitBreakerConfig.getIgnoreExceptionPredicate().test(notFound);

        // then
        assertThat(ignored).isTrue();
    }

    private static CircuitBreakerConfig apply(CircuitBreakerConfigCustomizer customizer) {
        CircuitBreakerConfig.Builder builder = CircuitBreakerConfig.custom();
        customizer.customize(builder);
        return builder.build();
    }
}
