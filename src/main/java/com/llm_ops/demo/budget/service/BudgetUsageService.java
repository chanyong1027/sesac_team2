package com.llm_ops.demo.budget.service;

import com.llm_ops.demo.budget.domain.BudgetMonthlyUsage;
import com.llm_ops.demo.budget.domain.BudgetScopeType;
import com.llm_ops.demo.budget.repository.BudgetMonthlyUsageRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.YearMonth;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BudgetUsageService {

    private final BudgetMonthlyUsageRepository budgetMonthlyUsageRepository;
    private final Clock clock = Clock.systemUTC();

    public BudgetUsageService(BudgetMonthlyUsageRepository budgetMonthlyUsageRepository) {
        this.budgetMonthlyUsageRepository = budgetMonthlyUsageRepository;
    }

    public YearMonth currentUtcYearMonth() {
        return YearMonth.from(LocalDateTime.ofInstant(Instant.now(clock), ZoneOffset.UTC));
    }

    public static int toYearMonthInt(YearMonth yearMonth) {
        return (yearMonth.getYear() * 100) + yearMonth.getMonthValue();
    }

    public static String toYearMonthString(YearMonth yearMonth) {
        return String.format("%04d-%02d", yearMonth.getYear(), yearMonth.getMonthValue());
    }

    @Transactional(readOnly = true)
    public Optional<BudgetMonthlyUsage> findUsage(BudgetScopeType scopeType, Long scopeId, YearMonth yearMonth) {
        if (scopeType == null || scopeId == null || scopeId <= 0 || yearMonth == null) {
            return Optional.empty();
        }
        return budgetMonthlyUsageRepository.findByScopeTypeAndScopeIdAndYearMonth(
            scopeType,
            scopeId,
            toYearMonthInt(yearMonth)
        );
    }

    @Transactional
    public void recordUsage(
        BudgetScopeType scopeType,
        Long scopeId,
        YearMonth yearMonth,
        BigDecimal costUsdDelta,
        Long totalTokensDelta
    ) {
        if (scopeType == null || scopeId == null || scopeId <= 0 || yearMonth == null) {
            return;
        }

        int ym = toYearMonthInt(yearMonth);
        for (int attempt = 0; attempt < 3; attempt++) {
            Optional<BudgetMonthlyUsage> existing = budgetMonthlyUsageRepository
                .findByScopeTypeAndScopeIdAndYearMonth(scopeType, scopeId, ym);
            if (existing.isPresent()) {
                existing.get().addUsage(costUsdDelta, totalTokensDelta, 1L);
                return;
            }

            try {
                BudgetMonthlyUsage created = BudgetMonthlyUsage.create(scopeType, scopeId, ym);
                created.addUsage(costUsdDelta, totalTokensDelta, 1L);
                budgetMonthlyUsageRepository.save(created);
                return;
            } catch (DataIntegrityViolationException ignored) {
                // 동시성으로 unique 충돌 시 재시도
            }
        }

        BudgetMonthlyUsage finalRow = budgetMonthlyUsageRepository
            .findByScopeTypeAndScopeIdAndYearMonth(scopeType, scopeId, ym)
            .orElseGet(() -> budgetMonthlyUsageRepository.save(BudgetMonthlyUsage.create(scopeType, scopeId, ym)));
        finalRow.addUsage(costUsdDelta, totalTokensDelta, 1L);
    }
}

