package com.llm_ops.demo.budget.repository;

import com.llm_ops.demo.budget.domain.BudgetMonthlyUsage;
import com.llm_ops.demo.budget.domain.BudgetScopeType;
import java.math.BigDecimal;
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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class BudgetMonthlyUsageRepositoryTest {

    @Autowired
    private BudgetMonthlyUsageRepository budgetMonthlyUsageRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @AfterEach
    void tearDown() {
        budgetMonthlyUsageRepository.deleteAll();
    }

    @Test
    @DisplayName("ensureUsageRow를 호출하면 usage row를 생성한다")
    void ensureUsageRow를_호출하면_usage_row를_생성한다() {
        // given
        Integer yearMonth = 202603;

        // when
        int inserted = executeInTransaction(() -> budgetMonthlyUsageRepository.ensureUsageRow(
            BudgetScopeType.WORKSPACE.name(),
            7L,
            yearMonth
        ));

        // then
        assertThat(inserted).isEqualTo(1);
        BudgetMonthlyUsage usage = budgetMonthlyUsageRepository
            .findByScopeTypeAndScopeIdAndYearMonth(BudgetScopeType.WORKSPACE, 7L, yearMonth)
            .orElseThrow();
        assertThat(usage.getReservedCostUsd()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    @DisplayName("reserveCostIfWithinLimit는 한도 내이면 1을 반환한다")
    void reserveCostIfWithinLimit는_한도_내이면_1을_반환한다() {
        // given
        Integer yearMonth = 202603;
        executeInTransaction(() -> budgetMonthlyUsageRepository.ensureUsageRow(BudgetScopeType.WORKSPACE.name(), 7L, yearMonth));

        // when
        int updated = executeInTransaction(() -> budgetMonthlyUsageRepository.reserveCostIfWithinLimit(
            BudgetScopeType.WORKSPACE.name(),
            7L,
            yearMonth,
            new BigDecimal("0.80"),
            new BigDecimal("1.00")
        ));

        // then
        assertThat(updated).isEqualTo(1);
        assertThat(budgetMonthlyUsageRepository.findByScopeTypeAndScopeIdAndYearMonth(BudgetScopeType.WORKSPACE, 7L, yearMonth))
            .isPresent()
            .get()
            .extracting(BudgetMonthlyUsage::getReservedCostUsd)
            .isEqualTo(new BigDecimal("0.80000000"));
    }

    @Test
    @DisplayName("reserveCostIfWithinLimit는 한도 초과이면 0을 반환한다")
    void reserveCostIfWithinLimit는_한도_초과이면_0을_반환한다() {
        // given
        Integer yearMonth = 202603;
        executeInTransaction(() -> budgetMonthlyUsageRepository.ensureUsageRow(BudgetScopeType.PROVIDER_CREDENTIAL.name(), 11L, yearMonth));
        executeInTransaction(() -> budgetMonthlyUsageRepository.reserveCostIfWithinLimit(
            BudgetScopeType.PROVIDER_CREDENTIAL.name(),
            11L,
            yearMonth,
            new BigDecimal("0.90"),
            new BigDecimal("1.00")
        ));

        // when
        int updated = executeInTransaction(() -> budgetMonthlyUsageRepository.reserveCostIfWithinLimit(
            BudgetScopeType.PROVIDER_CREDENTIAL.name(),
            11L,
            yearMonth,
            new BigDecimal("0.20"),
            new BigDecimal("1.00")
        ));

        // then
        assertThat(updated).isEqualTo(0);
    }

    @Test
    @DisplayName("settleReservation은 reserved를 차감하고 spent를 증가시킨다")
    void settleReservation은_reserved를_차감하고_spent를_증가시킨다() {
        // given
        Integer yearMonth = 202603;
        executeInTransaction(() -> budgetMonthlyUsageRepository.ensureUsageRow(BudgetScopeType.WORKSPACE.name(), 9L, yearMonth));
        executeInTransaction(() -> budgetMonthlyUsageRepository.reserveCostIfWithinLimit(
            BudgetScopeType.WORKSPACE.name(),
            9L,
            yearMonth,
            new BigDecimal("0.70"),
            new BigDecimal("5.00")
        ));

        // when
        int updated = executeInTransaction(() -> budgetMonthlyUsageRepository.settleReservation(
            BudgetScopeType.WORKSPACE.name(),
            9L,
            yearMonth,
            new BigDecimal("0.70"),
            new BigDecimal("0.42"),
            777L,
            1L
        ));

        // then
        assertThat(updated).isEqualTo(1);
        BudgetMonthlyUsage usage = budgetMonthlyUsageRepository
            .findByScopeTypeAndScopeIdAndYearMonth(BudgetScopeType.WORKSPACE, 9L, yearMonth)
            .orElseThrow();
        assertThat(usage.getReservedCostUsd()).isEqualByComparingTo("0.00000000");
        assertThat(usage.getCostUsd()).isEqualByComparingTo("0.42000000");
        assertThat(usage.getTotalTokens()).isEqualTo(777L);
        assertThat(usage.getRequestCount()).isEqualTo(1L);
    }

    @Test
    @DisplayName("releaseReservedCost는 reserved를 차감한다")
    void releaseReservedCost는_reserved를_차감한다() {
        // given
        Integer yearMonth = 202603;
        executeInTransaction(() -> budgetMonthlyUsageRepository.ensureUsageRow(BudgetScopeType.PROVIDER_CREDENTIAL.name(), 15L, yearMonth));
        executeInTransaction(() -> budgetMonthlyUsageRepository.reserveCostIfWithinLimit(
            BudgetScopeType.PROVIDER_CREDENTIAL.name(),
            15L,
            yearMonth,
            new BigDecimal("0.55"),
            new BigDecimal("1.00")
        ));

        // when
        int updated = executeInTransaction(() -> budgetMonthlyUsageRepository.releaseReservedCost(
            BudgetScopeType.PROVIDER_CREDENTIAL.name(),
            15L,
            yearMonth,
            new BigDecimal("0.55")
        ));

        // then
        assertThat(updated).isEqualTo(1);
        assertThat(budgetMonthlyUsageRepository.findByScopeTypeAndScopeIdAndYearMonth(BudgetScopeType.PROVIDER_CREDENTIAL, 15L, yearMonth))
            .isPresent()
            .get()
            .extracting(BudgetMonthlyUsage::getReservedCostUsd)
            .isEqualTo(new BigDecimal("0.00000000"));
    }

    @Test
    @DisplayName("동시에 reserve 두 건이 들어오면 한 건만 성공한다")
    void 동시에_reserve_두_건이_들어오면_한_건만_성공한다() throws Exception {
        // given
        Integer yearMonth = 202603;
        executeInTransaction(() -> budgetMonthlyUsageRepository.ensureUsageRow(BudgetScopeType.WORKSPACE.name(), 19L, yearMonth));
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        ExecutorService executorService = Executors.newFixedThreadPool(2);
        try {
            Future<Integer> first = executorService.submit(() -> reserveConcurrently(yearMonth, ready, start));
            Future<Integer> second = executorService.submit(() -> reserveConcurrently(yearMonth, ready, start));

            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();

            // when
            start.countDown();
            int firstResult = first.get(5, TimeUnit.SECONDS);
            int secondResult = second.get(5, TimeUnit.SECONDS);

            // then
            assertThat(firstResult + secondResult).isEqualTo(1);
            assertThat(budgetMonthlyUsageRepository.findByScopeTypeAndScopeIdAndYearMonth(BudgetScopeType.WORKSPACE, 19L, yearMonth))
                .isPresent()
                .get()
                .extracting(BudgetMonthlyUsage::getReservedCostUsd)
                .isEqualTo(new BigDecimal("0.60000000"));
        } finally {
            executorService.shutdownNow();
        }
    }

    private int reserveConcurrently(Integer yearMonth, CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        start.await(5, TimeUnit.SECONDS);
        return executeInTransaction(() -> budgetMonthlyUsageRepository.reserveCostIfWithinLimit(
            BudgetScopeType.WORKSPACE.name(),
            19L,
            yearMonth,
            new BigDecimal("0.60"),
            new BigDecimal("1.00")
        ));
    }

    private <T> T executeInTransaction(TransactionCallback<T> callback) {
        TransactionTemplate transactionTemplate = new TransactionTemplate(transactionManager);
        return transactionTemplate.execute(status -> callback.run());
    }

    @FunctionalInterface
    private interface TransactionCallback<T> {
        T run();
    }
}
