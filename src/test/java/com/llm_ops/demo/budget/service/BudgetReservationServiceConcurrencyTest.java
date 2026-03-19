package com.llm_ops.demo.budget.service;

import com.llm_ops.demo.budget.domain.BudgetReservation;
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
}
