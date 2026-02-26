package com.llm_ops.demo.eval.config;

import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.common.circuitbreaker.configuration.CircuitBreakerConfigCustomizer;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;

import static org.assertj.core.api.Assertions.assertThat;

class EvalCircuitBreakerConfigTest {

    private final EvalCircuitBreakerConfig config = new EvalCircuitBreakerConfig();

    @Test
    @DisplayName("4xx 요청 오류는 Eval circuit breaker 실패율 집계에서 제외된다")
    void 요청오류_4xx는_eval_집계에서_제외된다() {
        // given
        CircuitBreakerConfig circuitBreakerConfig = apply(config.evalOpenAiCircuitBreakerCustomizer());
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
    @DisplayName("429 제한 오류는 Eval circuit breaker 실패율 집계에 포함된다")
    void 제한오류_429는_eval_집계에_포함된다() {
        // given
        CircuitBreakerConfig circuitBreakerConfig = apply(config.evalOpenAiCircuitBreakerCustomizer());
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
    @DisplayName("5xx 및 네트워크 오류는 Eval circuit breaker 실패율 집계에 포함된다")
    void 서버_네트워크_오류는_eval_집계에_포함된다() {
        // given
        CircuitBreakerConfig circuitBreakerConfig = apply(config.evalGeminiCircuitBreakerCustomizer());
        HttpServerErrorException serviceUnavailable = HttpServerErrorException.create(
                HttpStatusCode.valueOf(503),
                "Service Unavailable",
                HttpHeaders.EMPTY,
                new byte[0],
                StandardCharsets.UTF_8
        );
        ResourceAccessException networkException =
                new ResourceAccessException("I/O error", new java.net.ConnectException("Connection refused"));
        TimeoutException timeoutException = new TimeoutException("timeout");

        // when
        boolean serverIgnored = circuitBreakerConfig.getIgnoreExceptionPredicate().test(serviceUnavailable);
        boolean networkIgnored = circuitBreakerConfig.getIgnoreExceptionPredicate().test(networkException);
        boolean timeoutIgnored = circuitBreakerConfig.getIgnoreExceptionPredicate().test(timeoutException);

        // then
        assertThat(serverIgnored).isFalse();
        assertThat(networkIgnored).isFalse();
        assertThat(timeoutIgnored).isFalse();
    }

    private static CircuitBreakerConfig apply(CircuitBreakerConfigCustomizer customizer) {
        CircuitBreakerConfig.Builder builder = CircuitBreakerConfig.custom();
        customizer.customize(builder);
        return builder.build();
    }
}
