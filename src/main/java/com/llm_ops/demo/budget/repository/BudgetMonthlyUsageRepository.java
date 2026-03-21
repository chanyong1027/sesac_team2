package com.llm_ops.demo.budget.repository;

import com.llm_ops.demo.budget.domain.BudgetMonthlyUsage;
import com.llm_ops.demo.budget.domain.BudgetScopeType;
import java.math.BigDecimal;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BudgetMonthlyUsageRepository extends JpaRepository<BudgetMonthlyUsage, Long> {
    Optional<BudgetMonthlyUsage> findByScopeTypeAndScopeIdAndYearMonth(
        BudgetScopeType scopeType,
        Long scopeId,
        Integer yearMonth
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        value = """
            INSERT INTO budget_monthly_usage (
                scope_type,
                scope_id,
                year_month,
                cost_usd,
                total_tokens,
                request_count,
                reserved_cost_usd,
                created_at,
                updated_at
            )
            SELECT
                :scopeType,
                :scopeId,
                :yearMonth,
                0,
                0,
                0,
                0,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            WHERE NOT EXISTS (
                SELECT 1
                FROM budget_monthly_usage
                WHERE scope_type = :scopeType
                  AND scope_id = :scopeId
                  AND year_month = :yearMonth
            )
            """,
        nativeQuery = true
    )
    int ensureUsageRow(
        @Param("scopeType") String scopeType,
        @Param("scopeId") Long scopeId,
        @Param("yearMonth") Integer yearMonth
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        value = """
            UPDATE budget_monthly_usage
            SET reserved_cost_usd = reserved_cost_usd + :reserveAmount
            WHERE scope_type = :scopeType
              AND scope_id = :scopeId
              AND year_month = :yearMonth
              AND cost_usd + reserved_cost_usd + :reserveAmount <= :monthLimitUsd
            """,
        nativeQuery = true
    )
    int reserveCostIfWithinLimit(
        @Param("scopeType") String scopeType,
        @Param("scopeId") Long scopeId,
        @Param("yearMonth") Integer yearMonth,
        @Param("reserveAmount") BigDecimal reserveAmount,
        @Param("monthLimitUsd") BigDecimal monthLimitUsd
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        value = """
            UPDATE budget_monthly_usage
            SET reserved_cost_usd = reserved_cost_usd - :reservedAmount,
                cost_usd = cost_usd + :actualCostUsd,
                total_tokens = total_tokens + :totalTokensDelta,
                request_count = request_count + :requestCountDelta
            WHERE scope_type = :scopeType
              AND scope_id = :scopeId
              AND year_month = :yearMonth
              AND reserved_cost_usd >= :reservedAmount
            """,
        nativeQuery = true
    )
    int settleReservation(
        @Param("scopeType") String scopeType,
        @Param("scopeId") Long scopeId,
        @Param("yearMonth") Integer yearMonth,
        @Param("reservedAmount") BigDecimal reservedAmount,
        @Param("actualCostUsd") BigDecimal actualCostUsd,
        @Param("totalTokensDelta") Long totalTokensDelta,
        @Param("requestCountDelta") Long requestCountDelta
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        value = """
            UPDATE budget_monthly_usage
            SET reserved_cost_usd = reserved_cost_usd - :reservedAmount
            WHERE scope_type = :scopeType
              AND scope_id = :scopeId
              AND year_month = :yearMonth
              AND reserved_cost_usd >= :reservedAmount
            """,
        nativeQuery = true
    )
    int releaseReservedCost(
        @Param("scopeType") String scopeType,
        @Param("scopeId") Long scopeId,
        @Param("yearMonth") Integer yearMonth,
        @Param("reservedAmount") BigDecimal reservedAmount
    );
}
