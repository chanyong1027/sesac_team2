package com.llm_ops.demo.budget.service;

import com.llm_ops.demo.budget.domain.BudgetScopeType;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

@Component
public class BudgetReservationMetrics {

    private final MeterRegistry registry;

    public BudgetReservationMetrics(MeterRegistry registry) {
        this.registry = registry;
    }

    public void incrementReserve(BudgetScopeType scopeType) {
        counter("gateway_budget_reserve_total", scopeType, null).increment();
    }

    public void incrementReserveFailed(BudgetScopeType scopeType, String reason) {
        counter("gateway_budget_reserve_failed_total", scopeType, reason).increment();
    }

    public void incrementSettle(BudgetScopeType scopeType) {
        counter("gateway_budget_settle_total", scopeType, null).increment();
    }

    public void incrementRelease(BudgetScopeType scopeType, String reason) {
        counter("gateway_budget_release_total", scopeType, reason).increment();
    }

    public void incrementExpired(BudgetScopeType scopeType) {
        counter("gateway_budget_reservation_expired_total", scopeType, null).increment();
    }

    private Counter counter(String name, BudgetScopeType scopeType, String reason) {
        Counter.Builder builder = Counter.builder(name)
            .tag("scope_type", safeScope(scopeType));
        if (reason != null && !reason.isBlank()) {
            builder.tag("reason", reason);
        }
        return builder.register(registry);
    }

    private String safeScope(BudgetScopeType scopeType) {
        return scopeType != null ? scopeType.name().toLowerCase() : "unknown";
    }
}
