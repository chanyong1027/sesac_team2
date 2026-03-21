package com.llm_ops.demo.budget.service;

import com.llm_ops.demo.budget.repository.BudgetMonthlyUsageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BudgetUsageRowInitializer {

    private final BudgetMonthlyUsageRepository budgetMonthlyUsageRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void ensureUsageRow(String scopeType, Long scopeId, Integer yearMonth) {
        budgetMonthlyUsageRepository.ensureUsageRow(scopeType, scopeId, yearMonth);
    }
}
