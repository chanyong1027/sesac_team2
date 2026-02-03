package com.llm_ops.demo.gateway.log.config;

import java.util.concurrent.Executor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * 비동기 로그 저장을 위한 설정 클래스입니다.
 * Gateway 요청 로그를 비동기로 저장하여 API 응답 시간에 영향을 주지 않도록 합니다.
 * 테스트 환경에서는 비활성화됩니다.
 */
@Configuration
@EnableAsync
@Profile("!test")
public class AsyncConfig {

    @Bean(name = "logExecutor")
    public Executor logExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(5);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("log-async-");
        executor.initialize();
        return executor;
    }
}
