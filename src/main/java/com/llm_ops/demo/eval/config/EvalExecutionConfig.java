package com.llm_ops.demo.eval.config;

import jakarta.annotation.PreDestroy;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Slf4j
@Configuration
public class EvalExecutionConfig {

    private final EvalProperties evalProperties;
    private ExecutorService evalRunExecutor;
    private ExecutorService evalCaseExecutor;

    public EvalExecutionConfig(EvalProperties evalProperties) {
        this.evalProperties = evalProperties;
    }

    @Bean(name = "evalRunExecutor")
    public ThreadPoolExecutor evalRunExecutor() {
        int maxConcurrentRuns = Math.max(1, evalProperties.getWorker().getMaxConcurrentRuns());
        AtomicInteger sequence = new AtomicInteger(1);
        ThreadFactory threadFactory = runnable -> {
            Thread thread = new Thread(runnable);
            thread.setName("eval-run-" + sequence.getAndIncrement());
            thread.setDaemon(true);
            return thread;
        };
        this.evalRunExecutor = new ThreadPoolExecutor(
                maxConcurrentRuns,
                maxConcurrentRuns,
                0L,
                TimeUnit.MILLISECONDS,
                new SynchronousQueue<>(),
                threadFactory,
                new ThreadPoolExecutor.AbortPolicy()
        );
        return (ThreadPoolExecutor) this.evalRunExecutor;
    }

    @Bean(name = "evalCaseExecutor")
    public ThreadPoolExecutor evalCaseExecutor() {
        int maxActiveCases = Math.max(1, evalProperties.getExecution().getMaxActiveCasesGlobal());
        int queueCapacity = Math.max(maxActiveCases, evalProperties.getExecution().getMaxCaseQueueCapacity());
        AtomicInteger sequence = new AtomicInteger(1);
        ThreadFactory threadFactory = runnable -> {
            Thread thread = new Thread(runnable);
            thread.setName("eval-case-" + sequence.getAndIncrement());
            thread.setDaemon(true);
            return thread;
        };
        BlockingQueue<Runnable> queue = new LinkedBlockingQueue<>(queueCapacity);
        this.evalCaseExecutor = new ThreadPoolExecutor(
                maxActiveCases,
                maxActiveCases,
                0L,
                TimeUnit.MILLISECONDS,
                queue,
                threadFactory,
                new ThreadPoolExecutor.AbortPolicy()
        );
        return (ThreadPoolExecutor) this.evalCaseExecutor;
    }

    @PreDestroy
    public void shutdownExecutors() {
        shutdownExecutor(evalCaseExecutor, "evalCaseExecutor");
        shutdownExecutor(evalRunExecutor, "evalRunExecutor");
    }

    private void shutdownExecutor(ExecutorService executorService, String name) {
        if (executorService == null) {
            return;
        }
        executorService.shutdown();
        try {
            if (!executorService.awaitTermination(30, TimeUnit.SECONDS)) {
                executorService.shutdownNow();
                if (!executorService.awaitTermination(5, TimeUnit.SECONDS)) {
                    log.warn("{} did not terminate within timeout", name);
                }
            }
        } catch (InterruptedException exception) {
            executorService.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
}
