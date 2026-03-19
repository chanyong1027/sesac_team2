package com.llm_ops.demo.budget.repository;

import com.llm_ops.demo.budget.domain.BudgetReservation;
import com.llm_ops.demo.budget.domain.BudgetReservationStatus;
import com.llm_ops.demo.budget.domain.BudgetScopeType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BudgetReservationRepository extends JpaRepository<BudgetReservation, Long> {
    Optional<BudgetReservation> findByTraceIdAndScopeTypeAndScopeId(
        String traceId,
        BudgetScopeType scopeType,
        Long scopeId
    );

    List<BudgetReservation> findTop100ByStatusAndExpiresAtBeforeOrderByExpiresAtAsc(
        BudgetReservationStatus status,
        LocalDateTime expiresAt
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
        update BudgetReservation r
        set r.status = com.llm_ops.demo.budget.domain.BudgetReservationStatus.SETTLED,
            r.settledCostUsd = :settledCostUsd,
            r.releaseReason = null,
            r.updatedAt = CURRENT_TIMESTAMP
        where r.id = :reservationId
          and r.status = com.llm_ops.demo.budget.domain.BudgetReservationStatus.RESERVED
        """)
    int markSettledIfReserved(
        @Param("reservationId") Long reservationId,
        @Param("settledCostUsd") java.math.BigDecimal settledCostUsd
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
        update BudgetReservation r
        set r.status = com.llm_ops.demo.budget.domain.BudgetReservationStatus.RELEASED,
            r.releaseReason = :releaseReason,
            r.updatedAt = CURRENT_TIMESTAMP
        where r.id = :reservationId
          and r.status = com.llm_ops.demo.budget.domain.BudgetReservationStatus.RESERVED
        """)
    int markReleasedIfReserved(
        @Param("reservationId") Long reservationId,
        @Param("releaseReason") String releaseReason
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
        update BudgetReservation r
        set r.status = com.llm_ops.demo.budget.domain.BudgetReservationStatus.EXPIRED,
            r.releaseReason = :releaseReason,
            r.updatedAt = CURRENT_TIMESTAMP
        where r.id = :reservationId
          and r.status = com.llm_ops.demo.budget.domain.BudgetReservationStatus.RESERVED
        """)
    int markExpiredIfReserved(
        @Param("reservationId") Long reservationId,
        @Param("releaseReason") String releaseReason
    );
}
