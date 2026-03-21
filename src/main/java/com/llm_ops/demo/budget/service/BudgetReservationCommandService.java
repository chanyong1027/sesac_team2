package com.llm_ops.demo.budget.service;

import com.llm_ops.demo.budget.domain.BudgetReservation;
import com.llm_ops.demo.budget.domain.BudgetScopeType;
import com.llm_ops.demo.budget.repository.BudgetMonthlyUsageRepository;
import com.llm_ops.demo.budget.repository.BudgetReservationRepository;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BudgetReservationCommandService {

    private final BudgetMonthlyUsageRepository budgetMonthlyUsageRepository;
    private final BudgetReservationRepository budgetReservationRepository;
    private final BudgetUsageRowInitializer budgetUsageRowInitializer;
    private final BudgetReservationMetrics budgetReservationMetrics;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<BudgetReservation> reserve(
        UUID requestLogId,
        String traceId,
        BudgetScopeType scopeType,
        Long scopeId,
        Integer yearMonth,
        BigDecimal monthLimitUsd,
        BigDecimal reserveAmount,
        String provider,
        String model,
        Integer reservedInputTokens,
        Integer reservedOutputTokens,
        LocalDateTime expiresAt
    ) {
        try {
            budgetUsageRowInitializer.ensureUsageRow(scopeType.name(), scopeId, yearMonth);
        } catch (DataIntegrityViolationException ignored) {
            // 동시 생성 경쟁으로 unique 충돌이 나도 다음 reserve 단계에서 동일 row를 사용하면 된다.
        }

        int reserved = budgetMonthlyUsageRepository.reserveCostIfWithinLimit(
            scopeType.name(),
            scopeId,
            yearMonth,
            reserveAmount,
            monthLimitUsd
        );
        if (reserved <= 0) {
            budgetReservationMetrics.incrementReserveFailed(scopeType, "LIMIT_EXCEEDED");
            return Optional.empty();
        }

        BudgetReservation saved = budgetReservationRepository.save(BudgetReservation.reserve(
            requestLogId,
            traceId,
            scopeType,
            scopeId,
            yearMonth,
            provider,
            model,
            reserveAmount,
            reservedInputTokens,
            reservedOutputTokens,
            expiresAt
        ));
        budgetReservationMetrics.incrementReserve(scopeType);
        return Optional.of(saved);
    }
}
