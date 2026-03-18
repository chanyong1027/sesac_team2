package com.llm_ops.demo.budget.repository;

import com.llm_ops.demo.budget.domain.BudgetReservation;
import com.llm_ops.demo.budget.domain.BudgetReservationStatus;
import com.llm_ops.demo.budget.domain.BudgetScopeType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

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
}
