package com.llm_ops.demo.budget.repository;

import com.llm_ops.demo.budget.domain.BudgetMonthlyUsage;
import com.llm_ops.demo.budget.domain.BudgetScopeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BudgetMonthlyUsageRepository extends JpaRepository<BudgetMonthlyUsage, Long> {
    Optional<BudgetMonthlyUsage> findByScopeTypeAndScopeIdAndYearMonth(
        BudgetScopeType scopeType,
        Long scopeId,
        Integer yearMonth
    );
}

