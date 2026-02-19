package com.llm_ops.demo.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Field;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class EmailCheckRateLimiterTest {

    @Test
    @DisplayName("같은 윈도우에서 요청 수가 한도를 넘으면 차단한다")
    void 같은_윈도우에서_요청_수가_한도를_넘으면_차단한다() {
        // given
        EmailCheckRateLimiter limiter = new EmailCheckRateLimiter(2, 60L);
        limiter.tryAcquire("127.0.0.1");
        limiter.tryAcquire("127.0.0.1");

        // when
        EmailCheckRateLimiter.RateLimitDecision decision = limiter.tryAcquire("127.0.0.1");

        // then
        assertThat(decision.allowed()).isFalse();
        assertThat(decision.retryAfterSeconds()).isGreaterThan(0L);
    }

    @Test
    @DisplayName("주기적 정리 시 만료된 IP 카운터를 제거한다")
    void 주기적_정리_시_만료된_IP_카운터를_제거한다() throws Exception {
        // given
        EmailCheckRateLimiter limiter = new EmailCheckRateLimiter(1, 1L);
        limiter.tryAcquire("expired-ip");
        Thread.sleep(1200L);

        // when
        for (int i = 0; i < 128; i++) {
            limiter.tryAcquire("active-ip-" + i);
        }

        // then
        assertThat(readCounters(limiter)).doesNotContainKey("expired-ip");
    }

    @SuppressWarnings("unchecked")
    private ConcurrentHashMap<String, ?> readCounters(EmailCheckRateLimiter limiter) throws Exception {
        Field countersField = EmailCheckRateLimiter.class.getDeclaredField("counters");
        countersField.setAccessible(true);
        return (ConcurrentHashMap<String, ?>) countersField.get(limiter);
    }
}
