package com.llm_ops.demo.auth.config;

import com.llm_ops.demo.auth.service.EmailCheckRateLimiter;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@ConditionalOnBean(EmailCheckRateLimiter.class)
@RequiredArgsConstructor
public class AuthWebMvcConfig implements WebMvcConfigurer {

    private final EmailCheckRateLimitInterceptor emailCheckRateLimitInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(emailCheckRateLimitInterceptor)
                .addPathPatterns("/api/v1/auth/check-email");
    }
}
