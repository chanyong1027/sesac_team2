package com.llm_ops.demo.gateway.service;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

@Component
public class GatewayMetrics {

    private final MeterRegistry registry;

    public GatewayMetrics(MeterRegistry registry) {
        this.registry = registry;
    }

    @PostConstruct
    void registerThreadPoolGauges() {
        if (GatewayChatService.PROVIDER_CALL_EXECUTOR instanceof ThreadPoolExecutor tpe) {
            registry.gauge("gateway_provider_call_threads_active", tpe, ThreadPoolExecutor::getActiveCount);
            registry.gauge("gateway_provider_call_queue_size", tpe, e -> e.getQueue().size());
        }
    }

    // ── Timers ──────────────────────────────────────────────────────────────

    public void recordLlmCall(String provider, String model, boolean isRag, boolean isFailover, String status, long elapsedNanos) {
        Timer.builder("gateway_llm_call_seconds")
                .tag("provider", safe(provider))
                .tag("model", safe(model))
                .tag("is_rag", String.valueOf(isRag))
                .tag("is_failover", String.valueOf(isFailover))
                .tag("status", safe(status))
                .register(registry)
                .record(elapsedNanos, TimeUnit.NANOSECONDS);
    }

    public void recordRagSearch(boolean hybridEnabled, long elapsedNanos) {
        Timer.builder("gateway_rag_search_seconds")
                .tag("hybrid_enabled", String.valueOf(hybridEnabled))
                .register(registry)
                .record(elapsedNanos, TimeUnit.NANOSECONDS);
    }

    public void recordBudgetEval(String scope, long elapsedNanos) {
        Timer.builder("gateway_budget_eval_seconds")
                .tag("scope", safe(scope))
                .register(registry)
                .record(elapsedNanos, TimeUnit.NANOSECONDS);
    }

    // ── Counters ────────────────────────────────────────────────────────────

    public void incrementLlmSuccess(String provider, String model) {
        Counter.builder("gateway_llm_success_total")
                .tag("provider", safe(provider))
                .tag("model", safe(model))
                .register(registry)
                .increment();
    }

    public void incrementLlmFailure(String provider, String model, String failReason) {
        Counter.builder("gateway_llm_failure_total")
                .tag("provider", safe(provider))
                .tag("model", safe(model))
                .tag("fail_reason", safe(failReason))
                .register(registry)
                .increment();
    }

    public void incrementFailover(String fromProvider, String toProvider) {
        Counter.builder("gateway_failover_total")
                .tag("from_provider", safe(fromProvider))
                .tag("to_provider", safe(toProvider))
                .register(registry)
                .increment();
    }

    public void incrementBudgetBlocked(String scopeType) {
        Counter.builder("gateway_budget_blocked_total")
                .tag("scope_type", safe(scopeType))
                .register(registry)
                .increment();
    }

    public void incrementBudgetDegrade(String scopeType) {
        Counter.builder("gateway_budget_degrade_total")
                .tag("scope_type", safe(scopeType))
                .register(registry)
                .increment();
    }

    // ── Distribution Summaries ──────────────────────────────────────────────

    public void recordInputTokens(String provider, String model, long tokens) {
        DistributionSummary.builder("gateway_input_tokens")
                .tag("provider", safe(provider))
                .tag("model", safe(model))
                .register(registry)
                .record(tokens);
    }

    public void recordOutputTokens(String provider, String model, long tokens) {
        DistributionSummary.builder("gateway_output_tokens")
                .tag("provider", safe(provider))
                .tag("model", safe(model))
                .register(registry)
                .record(tokens);
    }

    public void recordRagChunks(int chunks) {
        DistributionSummary.builder("gateway_rag_chunks")
                .register(registry)
                .record(chunks);
    }

    private static String safe(String value) {
        return value != null ? value : "unknown";
    }
}
