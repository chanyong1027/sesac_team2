package com.llm_ops.demo.gateway.config;

import jakarta.annotation.PreDestroy;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Slf4j
@Configuration
public class GatewayProviderCallExecutorConfig {

    private final int providerCallMaxThreads = 16;
    private ExecutorService providerCallExecutor;

    @Bean(name = "providerCallExecutor")
    public ExecutorService providerCallExecutor() {
        AtomicInteger threadSequence = new AtomicInteger(1);
        ThreadFactory threadFactory = runnable -> {
            Thread thread = new Thread(runnable);
            thread.setName("gateway-provider-call-" + threadSequence.getAndIncrement());
            thread.setDaemon(true);
            return thread;
        };
        this.providerCallExecutor = Executors.newFixedThreadPool(providerCallMaxThreads, threadFactory);
        return this.providerCallExecutor;
    }

    @PreDestroy
    public void shutdownProviderCallExecutor() {
        if (providerCallExecutor == null) {
            return;
        }
        providerCallExecutor.shutdown();
        try {
            if (!providerCallExecutor.awaitTermination(30, TimeUnit.SECONDS)) {
                providerCallExecutor.shutdownNow();
                if (!providerCallExecutor.awaitTermination(5, TimeUnit.SECONDS)) {
                    log.warn("providerCallExecutor did not terminate within timeout");
                }
            }
        } catch (InterruptedException exception) {
            providerCallExecutor.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
}
