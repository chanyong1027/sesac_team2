package com.llm_ops.demo.eval.service;

import com.llm_ops.demo.eval.repository.EvalRunRepository;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

@Component
public class EvalMetrics {

    private final MeterRegistry registry;
    private final EvalRunRepository evalRunRepository;

    public EvalMetrics(MeterRegistry registry, EvalRunRepository evalRunRepository) {
        this.registry = registry;
        this.evalRunRepository = evalRunRepository;
    }

    @PostConstruct
    void registerGauges() {
        registry.gauge("eval_queue_depth", evalRunRepository, repo -> repo.countByStatus("QUEUED"));
    }

    public void recordRunExecution(String mode, String triggerType, long elapsedNanos) {
        Timer.builder("eval_run_execution_seconds")
                .tag("mode", safe(mode))
                .tag("trigger_type", safe(triggerType))
                .register(registry)
                .record(elapsedNanos, TimeUnit.NANOSECONDS);
    }

    public void recordCaseExecution(String status, long elapsedNanos) {
        Timer.builder("eval_case_execution_seconds")
                .tag("status", safe(status))
                .register(registry)
                .record(elapsedNanos, TimeUnit.NANOSECONDS);
    }

    private static String safe(String value) {
        return value != null ? value : "unknown";
    }
}
