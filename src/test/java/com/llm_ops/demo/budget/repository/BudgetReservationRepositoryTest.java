package com.llm_ops.demo.budget.repository;

import com.llm_ops.demo.budget.domain.BudgetReservation;
import com.llm_ops.demo.budget.domain.BudgetReservationStatus;
import com.llm_ops.demo.budget.domain.BudgetScopeType;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class BudgetReservationRepositoryTest {

    @Autowired
    private BudgetReservationRepository budgetReservationRepository;

    @AfterEach
    void tearDown() {
        budgetReservationRepository.deleteAll();
    }

    @Test
    @DisplayName("traceId와 scope로 reservation을 조회한다")
    void traceId와_scope로_reservation을_조회한다() {
        // given
        BudgetReservation reservation = BudgetReservation.reserve(
            UUID.randomUUID(),
            "trace-lookup",
            BudgetScopeType.WORKSPACE,
            30L,
            202603,
            "openai",
            "gpt-4.1-mini",
            new BigDecimal("0.30"),
            1000,
            256,
            LocalDateTime.now().plusMinutes(1)
        );
        budgetReservationRepository.save(reservation);

        // when
        var result = budgetReservationRepository.findByTraceIdAndScopeTypeAndScopeId(
            "trace-lookup",
            BudgetScopeType.WORKSPACE,
            30L
        );

        // then
        assertThat(result).isPresent();
        assertThat(result.get().getModel()).isEqualTo("gpt-4.1-mini");
    }

    @Test
    @DisplayName("만료 시각 이전 RESERVED reservation만 조회한다")
    void 만료_시각_이전_RESERVED_reservation만_조회한다() {
        // given
        LocalDateTime now = LocalDateTime.now();
        budgetReservationRepository.save(BudgetReservation.reserve(
            UUID.randomUUID(),
            "trace-old",
            BudgetScopeType.WORKSPACE,
            30L,
            202603,
            "openai",
            "gpt-4.1-mini",
            new BigDecimal("0.30"),
            1000,
            256,
            now.minusMinutes(1)
        ));

        BudgetReservation releasedReservation = BudgetReservation.reserve(
            UUID.randomUUID(),
            "trace-released",
            BudgetScopeType.WORKSPACE,
            31L,
            202603,
            "openai",
            "gpt-4.1-mini",
            new BigDecimal("0.30"),
            1000,
            256,
            now.minusMinutes(2)
        );
        releasedReservation.markReleased("TEST");
        budgetReservationRepository.save(releasedReservation);

        budgetReservationRepository.save(BudgetReservation.reserve(
            UUID.randomUUID(),
            "trace-future",
            BudgetScopeType.WORKSPACE,
            32L,
            202603,
            "openai",
            "gpt-4.1-mini",
            new BigDecimal("0.30"),
            1000,
            256,
            now.plusMinutes(1)
        ));

        // when
        List<BudgetReservation> staleReservations = budgetReservationRepository
            .findTop100ByStatusAndExpiresAtBeforeOrderByExpiresAtAsc(BudgetReservationStatus.RESERVED, now);

        // then
        assertThat(staleReservations).hasSize(1);
        assertThat(staleReservations.get(0).getTraceId()).isEqualTo("trace-old");
    }
}
