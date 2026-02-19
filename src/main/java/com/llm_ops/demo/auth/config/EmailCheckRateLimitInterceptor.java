package com.llm_ops.demo.auth.config;

import com.llm_ops.demo.auth.service.EmailCheckRateLimiter;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.global.error.RateLimitExceededException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
@ConditionalOnBean(EmailCheckRateLimiter.class)
@RequiredArgsConstructor
public class EmailCheckRateLimitInterceptor implements HandlerInterceptor {

    private final EmailCheckRateLimiter emailCheckRateLimiter;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!"GET".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        EmailCheckRateLimiter.RateLimitDecision decision = emailCheckRateLimiter.tryAcquire(resolveClientIp(request));
        if (decision.allowed()) {
            return true;
        }
        throw new RateLimitExceededException(ErrorCode.EMAIL_CHECK_RATE_LIMITED, decision.retryAfterSeconds());
    }

    private String resolveClientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        return remoteAddr != null ? remoteAddr : "unknown";
    }
}
