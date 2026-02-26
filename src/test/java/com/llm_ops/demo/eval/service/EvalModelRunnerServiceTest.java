package com.llm_ops.demo.eval.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.llm_ops.demo.eval.config.EvalProperties;
import com.llm_ops.demo.gateway.service.GatewayChatOptionsCreateService;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.keys.service.ProviderCredentialService;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.util.List;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;

class EvalModelRunnerServiceTest {

    private EvalProperties evalProperties;
    private ProviderCredentialService providerCredentialService;
    private GatewayChatOptionsCreateService gatewayChatOptionsCreateService;
    private CircuitBreakerRegistry circuitBreakerRegistry;
    private CircuitBreaker circuitBreaker;
    private EvalModelRunnerService service;

    @BeforeEach
    void setUp() {
        evalProperties = new EvalProperties();
        providerCredentialService = mock(ProviderCredentialService.class);
        gatewayChatOptionsCreateService = mock(GatewayChatOptionsCreateService.class);
        circuitBreakerRegistry = mock(CircuitBreakerRegistry.class);
        circuitBreaker = mock(CircuitBreaker.class);
        service = new EvalModelRunnerService(
                evalProperties,
                providerCredentialService,
                gatewayChatOptionsCreateService,
                circuitBreakerRegistry
        );

        when(providerCredentialService.resolveApiKey(1L, ProviderType.OPENAI))
                .thenReturn(new ProviderCredentialService.ResolvedProviderApiKey(10L, ProviderType.OPENAI, "provider-key"));
        when(circuitBreakerRegistry.circuitBreaker("eval-openai")).thenReturn(circuitBreaker);
    }

    @Test
    @DisplayName("Eval 모델 호출은 provider별 eval circuit breaker를 통해 실행된다")
    void eval_모델_호출은_provider별_eval_circuit_breaker를_통해_실행된다() throws Exception {
        // given
        ChatResponse response = new ChatResponse(
                List.of(new Generation(new AssistantMessage("ok"))),
                ChatResponseMetadata.builder().model("gpt-4.1-mini").build()
        );
        when(circuitBreaker.executeCallable(any())).thenReturn(response);

        // when
        EvalModelRunnerService.ModelExecution execution = service.run(
                1L,
                ProviderType.OPENAI,
                "gpt-4.1-mini",
                "hello",
                0.0,
                32
        );

        // then
        assertThat(execution.outputText()).isEqualTo("ok");
        assertThat(execution.meta().get("retryCount")).isEqualTo(0);
        verify(circuitBreakerRegistry).circuitBreaker("eval-openai");
        verify(circuitBreaker, times(1)).executeCallable(any());
    }

    @Test
    @DisplayName("Retry 대상 장애는 동일 provider로 1회 재시도 후 성공할 수 있다")
    void retry_대상_장애는_동일_provider로_1회_재시도한다() throws Exception {
        // given
        evalProperties.getRunner().setSameProviderRetryMaxAttempts(1);
        evalProperties.getRunner().setSameProviderRetryBackoffMs(0L);

        ChatResponse response = new ChatResponse(
                List.of(new Generation(new AssistantMessage("retry-ok"))),
                ChatResponseMetadata.builder().model("gpt-4.1-mini").build()
        );
        when(circuitBreaker.executeCallable(any()))
                .thenThrow(new RuntimeException(new TimeoutException("timeout")))
                .thenReturn(response);

        // when
        EvalModelRunnerService.ModelExecution execution = service.run(
                1L,
                ProviderType.OPENAI,
                "gpt-4.1-mini",
                "hello",
                0.0,
                32
        );

        // then
        assertThat(execution.outputText()).isEqualTo("retry-ok");
        assertThat(execution.meta().get("retryCount")).isEqualTo(1);
        verify(circuitBreaker, times(2)).executeCallable(any());
    }

    @Test
    @DisplayName("Fail-fast 예외는 동일 provider 재시도 없이 즉시 실패한다")
    void fail_fast_예외는_재시도_없이_즉시_실패한다() throws Exception {
        // given
        when(circuitBreaker.executeCallable(any()))
                .thenThrow(new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "invalid request"));

        // when // then
        assertThatThrownBy(() -> service.run(1L, ProviderType.OPENAI, "gpt-4.1-mini", "hello", 0.0, 32))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException businessException = (BusinessException) ex;
                    assertThat(businessException.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT_VALUE);
                });
        verify(circuitBreaker, times(1)).executeCallable(any());
    }

    @Test
    @DisplayName("same-provider-retry-max-attempts가 0이면 retry 대상 장애도 재시도하지 않는다")
    void same_provider_retry_max_attempts가_0이면_retry하지_않는다() throws Exception {
        // given
        evalProperties.getRunner().setSameProviderRetryMaxAttempts(0);
        when(circuitBreaker.executeCallable(any()))
                .thenThrow(new RuntimeException(new TimeoutException("timeout")));

        // when // then
        assertThatThrownBy(() -> service.run(1L, ProviderType.OPENAI, "gpt-4.1-mini", "hello", 0.0, 32))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException businessException = (BusinessException) ex;
                    assertThat(businessException.getErrorCode()).isEqualTo(ErrorCode.INTERNAL_SERVER_ERROR);
                });
        verify(circuitBreaker, times(1)).executeCallable(any());
    }
}
