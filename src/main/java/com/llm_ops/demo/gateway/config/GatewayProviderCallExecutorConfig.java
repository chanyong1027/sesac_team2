package com.llm_ops.demo.gateway.config;

import jakarta.annotation.PreDestroy;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Slf4j
@Configuration
public class GatewayProviderCallExecutorConfig {

    private final GatewayReliabilityProperties reliabilityProperties;
    private ExecutorService providerCallExecutor;

    public GatewayProviderCallExecutorConfig(GatewayReliabilityProperties reliabilityProperties) {
        this.reliabilityProperties = reliabilityProperties;
    }

    @Bean(name = "providerCallExecutor")
    public ExecutorService providerCallExecutor() {
        int providerCallMaxThreads = reliabilityProperties.resolvedProviderCallMaxThreads();
        int providerCallQueueCapacity = reliabilityProperties.resolvedProviderCallQueueCapacity();
        AtomicInteger threadSequence = new AtomicInteger(1);
        ThreadFactory threadFactory = runnable -> {
            Thread thread = new Thread(runnable);
            thread.setName("gateway-provider-call-" + threadSequence.getAndIncrement());
            thread.setDaemon(true);
            return thread;
        };
        BlockingQueue<Runnable> workQueue = new LinkedBlockingQueue<>(providerCallQueueCapacity);
        this.providerCallExecutor = new ThreadPoolExecutor(
                providerCallMaxThreads,
                providerCallMaxThreads,
                0L,
                TimeUnit.MILLISECONDS,
                workQueue,
                threadFactory,
                new ThreadPoolExecutor.CallerRunsPolicy()
        );
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
