package com.llm_ops.demo.budget.service;

import com.llm_ops.demo.budget.domain.BudgetScopeType;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BudgetReservationMetricsTest {

    @Test
    @DisplayName("reservation 메트릭을 이름과 태그 기준으로 누적한다")
    void reservation_메트릭을_이름과_태그_기준으로_누적한다() {
        // given
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        BudgetReservationMetrics metrics = new BudgetReservationMetrics(registry);

        // when
        metrics.incrementReserve(BudgetScopeType.PROVIDER_CREDENTIAL);
        metrics.incrementReserveFailed(BudgetScopeType.PROVIDER_CREDENTIAL, "LIMIT_EXCEEDED");
        metrics.incrementSettle(BudgetScopeType.PROVIDER_CREDENTIAL);
        metrics.incrementRelease(BudgetScopeType.PROVIDER_CREDENTIAL, "PRIMARY_ROUTE_FAILED");
        metrics.incrementExpired(BudgetScopeType.PROVIDER_CREDENTIAL);

        // then
        assertThat(registry.get("gateway_budget_reserve_total")
            .tag("scope_type", "provider_credential")
            .counter()
            .count()).isEqualTo(1.0);
        assertThat(registry.get("gateway_budget_reserve_failed_total")
            .tag("scope_type", "provider_credential")
            .tag("reason", "LIMIT_EXCEEDED")
            .counter()
            .count()).isEqualTo(1.0);
        assertThat(registry.get("gateway_budget_settle_total")
            .tag("scope_type", "provider_credential")
            .counter()
            .count()).isEqualTo(1.0);
        assertThat(registry.get("gateway_budget_release_total")
            .tag("scope_type", "provider_credential")
            .tag("reason", "PRIMARY_ROUTE_FAILED")
            .counter()
            .count()).isEqualTo(1.0);
        assertThat(registry.get("gateway_budget_reservation_expired_total")
            .tag("scope_type", "provider_credential")
            .counter()
            .count()).isEqualTo(1.0);
    }
}
