package com.llm_ops.demo.budget.service;

import com.llm_ops.demo.budget.domain.BudgetReservation;
import com.llm_ops.demo.budget.domain.BudgetReservationStatus;
import com.llm_ops.demo.budget.domain.BudgetScopeType;
import com.llm_ops.demo.budget.repository.BudgetMonthlyUsageRepository;
import com.llm_ops.demo.budget.repository.BudgetReservationRepository;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BudgetReservationServiceTest {

    @Mock
    private BudgetMonthlyUsageRepository budgetMonthlyUsageRepository;

    @Mock
    private BudgetReservationRepository budgetReservationRepository;

    @Mock
    private BudgetUsageRowInitializer budgetUsageRowInitializer;

    @Mock
    private BudgetReservationMetrics budgetReservationMetrics;

    @InjectMocks
    private BudgetReservationService budgetReservationService;

    @Test
    @DisplayName("예산 한도 내이면 reservation을 생성한다")
    void 예산_한도_내이면_reservation을_생성한다() {
        // given
        UUID requestLogId = UUID.randomUUID();
        String traceId = "trace-1";
        YearMonth yearMonth = YearMonth.of(2026, 3);
        BigDecimal monthLimitUsd = new BigDecimal("10.00");
        BigDecimal reserveAmount = new BigDecimal("0.80");

        when(budgetMonthlyUsageRepository.reserveCostIfWithinLimit(
            eq(BudgetScopeType.PROVIDER_CREDENTIAL.name()),
            eq(10L),
            eq(202603),
            eq(reserveAmount),
            eq(monthLimitUsd)
        )).thenReturn(1);
        when(budgetReservationRepository.save(any(BudgetReservation.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        // when
        Optional<BudgetReservation> result = budgetReservationService.reserve(
            requestLogId,
            traceId,
            BudgetScopeType.PROVIDER_CREDENTIAL,
            10L,
            yearMonth,
            monthLimitUsd,
            reserveAmount,
            "openai",
            "gpt-4.1-mini",
            1200,
            512,
            Duration.ofSeconds(90)
        );

        // then
        assertThat(result).isPresent();
        assertThat(result.get().getTraceId()).isEqualTo(traceId);
        assertThat(result.get().getStatus()).isEqualTo(BudgetReservationStatus.RESERVED);
        assertThat(result.get().getReservedCostUsd()).isEqualByComparingTo(reserveAmount);
        verify(budgetUsageRowInitializer).ensureUsageRow(BudgetScopeType.PROVIDER_CREDENTIAL.name(), 10L, 202603);
        verify(budgetReservationMetrics).incrementReserve(BudgetScopeType.PROVIDER_CREDENTIAL);
    }

    @Test
    @DisplayName("예산 한도 초과이면 reservation을 생성하지 않는다")
    void 예산_한도_초과이면_reservation을_생성하지_않는다() {
        // given
        when(budgetMonthlyUsageRepository.reserveCostIfWithinLimit(
            eq(BudgetScopeType.WORKSPACE.name()),
            eq(7L),
            eq(202603),
            eq(new BigDecimal("1.50")),
            eq(new BigDecimal("5.00"))
        )).thenReturn(0);

        // when
        Optional<BudgetReservation> result = budgetReservationService.reserve(
            UUID.randomUUID(),
            "trace-2",
            BudgetScopeType.WORKSPACE,
            7L,
            YearMonth.of(2026, 3),
            new BigDecimal("5.00"),
            new BigDecimal("1.50"),
            "openai",
            "gpt-4.1-mini",
            1000,
            256,
            Duration.ofSeconds(60)
        );

        // then
        assertThat(result).isEmpty();
        verify(budgetReservationMetrics).incrementReserveFailed(BudgetScopeType.WORKSPACE, "LIMIT_EXCEEDED");
    }

    @Test
    @DisplayName("reservation이 RESERVED 상태이면 settle한다")
    void reservation이_RESERVED_상태이면_settle한다() {
        // given
        when(budgetReservationRepository.findById(1L)).thenReturn(Optional.of(BudgetReservation.reserve(
            UUID.randomUUID(),
            "trace-3",
            BudgetScopeType.PROVIDER_CREDENTIAL,
            11L,
            202603,
            "openai",
            "gpt-4.1-mini",
            new BigDecimal("0.70"),
            900,
            256,
            java.time.LocalDateTime.now().plusMinutes(1)
        )));

        when(budgetReservationRepository.markSettledIfReserved(1L, new BigDecimal("0.42"))).thenReturn(1);
        when(budgetMonthlyUsageRepository.settleReservation(
            eq(BudgetScopeType.PROVIDER_CREDENTIAL.name()),
            eq(11L),
            eq(202603),
            eq(new BigDecimal("0.70")),
            eq(new BigDecimal("0.42")),
            eq(777L),
            eq(1L)
        )).thenReturn(1);

        // when
        budgetReservationService.settle(1L, new BigDecimal("0.42"), 777L);

        // then
        verify(budgetReservationRepository).markSettledIfReserved(1L, new BigDecimal("0.42"));
        verify(budgetReservationMetrics).incrementSettle(BudgetScopeType.PROVIDER_CREDENTIAL);
    }

    @Test
    @DisplayName("reservation이 RESERVED 상태이면 release한다")
    void reservation이_RESERVED_상태이면_release한다() {
        // given
        BudgetReservation reservation = BudgetReservation.reserve(
            UUID.randomUUID(),
            "trace-4",
            BudgetScopeType.WORKSPACE,
            8L,
            202603,
            "openai",
            "gpt-4.1-mini",
            new BigDecimal("0.55"),
            800,
            256,
            java.time.LocalDateTime.now().plusMinutes(1)
        );
        ReflectionTestUtils.setField(reservation, "id", 2L);

        when(budgetReservationRepository.findById(2L)).thenReturn(Optional.of(reservation));

        when(budgetReservationRepository.markReleasedIfReserved(2L, "PRIMARY_ROUTE_FAILED")).thenReturn(1);
        when(budgetMonthlyUsageRepository.releaseReservedCost(
            eq(BudgetScopeType.WORKSPACE.name()),
            eq(8L),
            eq(202603),
            eq(new BigDecimal("0.55"))
        )).thenReturn(1);

        // when
        budgetReservationService.release(2L, "PRIMARY_ROUTE_FAILED");

        // then
        verify(budgetReservationRepository).markReleasedIfReserved(2L, "PRIMARY_ROUTE_FAILED");
        verify(budgetReservationMetrics).incrementRelease(BudgetScopeType.WORKSPACE, "PRIMARY_ROUTE_FAILED");
    }

    @Test
    @DisplayName("만료된 reservation이 있으면 EXPIRED로 복구한다")
    void 만료된_reservation이_있으면_EXPIRED로_복구한다() {
        // given
        BudgetReservation reservation = BudgetReservation.reserve(
            UUID.randomUUID(),
            "trace-expired",
            BudgetScopeType.PROVIDER_CREDENTIAL,
            12L,
            202603,
            "openai",
            "gpt-4.1-mini",
            new BigDecimal("0.33"),
            700,
            256,
            LocalDateTime.now().minusMinutes(1)
        );
        ReflectionTestUtils.setField(reservation, "id", 1L);
        when(budgetReservationRepository.findTop100ByStatusAndExpiresAtBeforeOrderByExpiresAtAsc(
            eq(BudgetReservationStatus.RESERVED),
            any(LocalDateTime.class)
        )).thenReturn(List.of(reservation));
        when(budgetReservationRepository.markExpiredIfReserved(1L, "RESERVATION_EXPIRED")).thenReturn(1);
        when(budgetMonthlyUsageRepository.releaseReservedCost(
            eq(BudgetScopeType.PROVIDER_CREDENTIAL.name()),
            eq(12L),
            eq(202603),
            eq(new BigDecimal("0.33"))
        )).thenReturn(1);

        // when
        int expiredCount = budgetReservationService.expireStaleReservations();

        // then
        assertThat(expiredCount).isEqualTo(1);
        verify(budgetReservationRepository).markExpiredIfReserved(1L, "RESERVATION_EXPIRED");
        verify(budgetReservationMetrics).incrementExpired(BudgetScopeType.PROVIDER_CREDENTIAL);
    }

    @Test
    @DisplayName("정산 도중 다른 경로가 먼저 종료한 reservation이면 조용히 종료한다")
    void 정산_도중_다른_경로가_먼저_종료한_reservation이면_조용히_종료한다() {
        // given
        BudgetReservation reservedReservation = BudgetReservation.reserve(
            UUID.randomUUID(),
            "trace-race",
            BudgetScopeType.PROVIDER_CREDENTIAL,
            13L,
            202603,
            "openai",
            "gpt-4.1-mini",
            new BigDecimal("0.25"),
            100,
            64,
            LocalDateTime.now().plusMinutes(1)
        );
        BudgetReservation releasedReservation = BudgetReservation.reserve(
            UUID.randomUUID(),
            "trace-race",
            BudgetScopeType.PROVIDER_CREDENTIAL,
            13L,
            202603,
            "openai",
            "gpt-4.1-mini",
            new BigDecimal("0.25"),
            100,
            64,
            LocalDateTime.now().plusMinutes(1)
        );
        releasedReservation.markReleased("PRIMARY_ROUTE_FAILED");

        when(budgetReservationRepository.findById(3L))
            .thenReturn(Optional.of(reservedReservation))
            .thenReturn(Optional.of(releasedReservation));
        when(budgetReservationRepository.markSettledIfReserved(3L, new BigDecimal("0.10"))).thenReturn(0);

        // when
        budgetReservationService.settle(3L, new BigDecimal("0.10"), 77L);

        // then
        verify(budgetMonthlyUsageRepository, never()).settleReservation(any(), any(), any(), any(), any(), any(), any());
        verify(budgetReservationMetrics, never()).incrementSettle(any());
    }
}
