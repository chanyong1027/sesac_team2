package com.llm_ops.demo.budget.service;

import com.llm_ops.demo.budget.domain.BudgetMonthlyUsage;
import com.llm_ops.demo.budget.domain.BudgetReservation;
import com.llm_ops.demo.budget.domain.BudgetReservationStatus;
import com.llm_ops.demo.budget.domain.BudgetScopeType;
import com.llm_ops.demo.budget.repository.BudgetMonthlyUsageRepository;
import com.llm_ops.demo.budget.repository.BudgetReservationRepository;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.YearMonth;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class BudgetReservationServiceConcurrencyTest {

    @Autowired
    private BudgetReservationService budgetReservationService;

    @Autowired
    private BudgetMonthlyUsageRepository budgetMonthlyUsageRepository;

    @Autowired
    private BudgetReservationRepository budgetReservationRepository;

    @AfterEach
    void tearDown() {
        budgetReservationRepository.deleteAll();
        budgetMonthlyUsageRepository.deleteAll();
    }

    @Test
    @DisplayName("동시에 reserve 두 건이 들어오면 한 건만 reservation을 생성한다")
    void 동시에_reserve_두_건이_들어오면_한_건만_reservation을_생성한다() throws Exception {
        // given
        YearMonth yearMonth = YearMonth.of(2026, 3);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executorService = Executors.newFixedThreadPool(2);

        try {
            Future<Optional<BudgetReservation>> first = executorService.submit(() ->
                reserveConcurrently("trace-concurrency-1", yearMonth, ready, start)
            );
            Future<Optional<BudgetReservation>> second = executorService.submit(() ->
                reserveConcurrently("trace-concurrency-2", yearMonth, ready, start)
            );

            ready.await(5, TimeUnit.SECONDS);

            // when
            start.countDown();
            Optional<BudgetReservation> firstResult = first.get(5, TimeUnit.SECONDS);
            Optional<BudgetReservation> secondResult = second.get(5, TimeUnit.SECONDS);

            // then
            long successCount = java.util.stream.Stream.of(firstResult, secondResult)
                .filter(Optional::isPresent)
                .count();
            assertThat(successCount).isEqualTo(1);
            assertThat(budgetReservationRepository.findAll()).hasSize(1);
            assertThat(budgetMonthlyUsageRepository.findByScopeTypeAndScopeIdAndYearMonth(
                BudgetScopeType.PROVIDER_CREDENTIAL,
                21L,
                202603
            )).isPresent().get()
                .extracting(usage -> usage.getReservedCostUsd())
                .isEqualTo(new BigDecimal("0.60000000"));
        } finally {
            executorService.shutdownNow();
        }
    }

    @Test
    @DisplayName("settle 이후 reservation 상태가 SETTLED로 저장된다")
    void settle_이후_reservation_상태가_SETTLED로_저장된다() {
        // given
        BudgetReservation reservation = reserveSingle("trace-settle", 31L, new BigDecimal("1.00"), new BigDecimal("0.40"));

        // when
        budgetReservationService.settle(reservation.getId(), BigDecimal.ZERO, 0L);

        // then
        BudgetReservation settled = budgetReservationRepository.findById(reservation.getId()).orElseThrow();
        assertThat(settled.getStatus()).isEqualTo(BudgetReservationStatus.SETTLED);
        assertThat(settled.getSettledCostUsd()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    @DisplayName("release 이후 reservation 상태가 RELEASED로 저장된다")
    void release_이후_reservation_상태가_RELEASED로_저장된다() {
        // given
        BudgetReservation reservation = reserveSingle("trace-release", 32L, new BigDecimal("1.00"), new BigDecimal("0.40"));

        // when
        budgetReservationService.release(reservation.getId(), "TEST_RELEASE");

        // then
        BudgetReservation released = budgetReservationRepository.findById(reservation.getId()).orElseThrow();
        assertThat(released.getStatus()).isEqualTo(BudgetReservationStatus.RELEASED);
        assertThat(released.getReleaseReason()).isEqualTo("TEST_RELEASE");
    }

    @Test
    @DisplayName("settle과 release가 동시에 실행돼도 reservation은 한 번만 최종 처리된다")
    void settle과_release가_동시에_실행돼도_reservation은_한_번만_최종_처리된다() throws Exception {
        // given
        BudgetReservation reservation = reserveSingle("trace-settle-release-race", 33L, new BigDecimal("1.00"), new BigDecimal("0.40"));
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executorService = Executors.newFixedThreadPool(2);

        try {
            Future<Void> settleFuture = executorService.submit(() -> {
                ready.countDown();
                start.await(5, TimeUnit.SECONDS);
                budgetReservationService.settle(reservation.getId(), new BigDecimal("0.18"), 123L);
                return null;
            });
            Future<Void> releaseFuture = executorService.submit(() -> {
                ready.countDown();
                start.await(5, TimeUnit.SECONDS);
                budgetReservationService.release(reservation.getId(), "TEST_RACE");
                return null;
            });

            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();

            // when
            start.countDown();
            settleFuture.get(5, TimeUnit.SECONDS);
            releaseFuture.get(5, TimeUnit.SECONDS);

            // then
            BudgetReservation finalizedReservation = budgetReservationRepository.findById(reservation.getId()).orElseThrow();
            assertThat(finalizedReservation.getStatus())
                .isIn(BudgetReservationStatus.SETTLED, BudgetReservationStatus.RELEASED);

            assertUsageMatchesTerminalState(finalizedReservation, 33L);
        } finally {
            executorService.shutdownNow();
        }
    }

    private Optional<BudgetReservation> reserveConcurrently(
        String traceId,
        YearMonth yearMonth,
        CountDownLatch ready,
        CountDownLatch start
    ) throws Exception {
        ready.countDown();
        start.await(5, TimeUnit.SECONDS);
        return budgetReservationService.reserve(
            UUID.randomUUID(),
            traceId,
            BudgetScopeType.PROVIDER_CREDENTIAL,
            21L,
            yearMonth,
            new BigDecimal("1.00"),
            new BigDecimal("0.60"),
            "openai",
            "gpt-4.1-mini",
            100,
            256,
            Duration.ofSeconds(60)
        );
    }

    private BudgetReservation reserveSingle(
        String traceId,
        Long scopeId,
        BigDecimal monthLimitUsd,
        BigDecimal reserveAmount
    ) {
        return budgetReservationService.reserve(
            UUID.randomUUID(),
            traceId,
            BudgetScopeType.PROVIDER_CREDENTIAL,
            scopeId,
            YearMonth.of(2026, 3),
            monthLimitUsd,
            reserveAmount,
            "openai",
            "gpt-4.1-mini",
            100,
            256,
            Duration.ofSeconds(60)
        ).orElseThrow();
    }

    private void assertUsageMatchesTerminalState(BudgetReservation finalizedReservation, Long scopeId) {
        BudgetMonthlyUsage usage = budgetMonthlyUsageRepository.findByScopeTypeAndScopeIdAndYearMonth(
            BudgetScopeType.PROVIDER_CREDENTIAL,
            scopeId,
            202603
        ).orElseThrow();

        assertThat(usage.getReservedCostUsd()).isEqualByComparingTo(BigDecimal.ZERO);

        if (finalizedReservation.getStatus() == BudgetReservationStatus.SETTLED) {
            assertThat(finalizedReservation.getSettledCostUsd()).isEqualByComparingTo(new BigDecimal("0.18"));
            assertThat(usage.getCostUsd()).isEqualByComparingTo(new BigDecimal("0.18"));
            assertThat(usage.getTotalTokens()).isEqualTo(123L);
            assertThat(usage.getRequestCount()).isEqualTo(1L);
            return;
        }

        assertThat(finalizedReservation.getReleaseReason()).isEqualTo("TEST_RACE");
        assertThat(usage.getCostUsd()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(usage.getTotalTokens()).isEqualTo(0L);
        assertThat(usage.getRequestCount()).isEqualTo(0L);
    }
}
