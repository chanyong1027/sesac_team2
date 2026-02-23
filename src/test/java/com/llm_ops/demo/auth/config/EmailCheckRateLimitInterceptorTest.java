package com.llm_ops.demo.auth.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.llm_ops.demo.auth.service.EmailCheckRateLimiter;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.global.error.RateLimitExceededException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EmailCheckRateLimitInterceptorTest {

    @InjectMocks
    private EmailCheckRateLimitInterceptor interceptor;

    @Mock
    private EmailCheckRateLimiter emailCheckRateLimiter;

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    @Test
    @DisplayName("GET 요청은 remoteAddr 기준으로 제한을 검사한다")
    void GET_요청은_remoteAddr_기준으로_제한을_검사한다() {
        // given
        given(request.getMethod()).willReturn("GET");
        given(request.getRemoteAddr()).willReturn("10.0.0.12");
        given(emailCheckRateLimiter.tryAcquire("10.0.0.12"))
                .willReturn(new EmailCheckRateLimiter.RateLimitDecision(true, 0L));

        // when
        boolean allowed = interceptor.preHandle(request, response, new Object());

        // then
        assertThat(allowed).isTrue();
        verify(emailCheckRateLimiter).tryAcquire("10.0.0.12");
    }

    @Test
    @DisplayName("요청 제한을 초과하면 RateLimitExceededException이 발생한다")
    void 요청_제한을_초과하면_RateLimitExceededException이_발생한다() {
        // given
        given(request.getMethod()).willReturn("GET");
        given(request.getRemoteAddr()).willReturn("10.0.0.12");
        given(emailCheckRateLimiter.tryAcquire("10.0.0.12"))
                .willReturn(new EmailCheckRateLimiter.RateLimitDecision(false, 3L));

        // when // then
        assertThatThrownBy(() -> interceptor.preHandle(request, response, new Object()))
                .isInstanceOf(RateLimitExceededException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.EMAIL_CHECK_RATE_LIMITED);
    }

    @Test
    @DisplayName("GET 외 요청은 rate limiter를 거치지 않는다")
    void GET_외_요청은_rate_limiter를_거치지_않는다() {
        // given
        given(request.getMethod()).willReturn("POST");

        // when
        boolean allowed = interceptor.preHandle(request, response, new Object());

        // then
        assertThat(allowed).isTrue();
        verifyNoInteractions(emailCheckRateLimiter);
    }
}
