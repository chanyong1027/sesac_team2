package com.llm_ops.demo.budget.repository;

import com.llm_ops.demo.budget.domain.BudgetPolicy;
import com.llm_ops.demo.budget.domain.BudgetScopeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BudgetPolicyRepository extends JpaRepository<BudgetPolicy, Long> {
    Optional<BudgetPolicy> findByScopeTypeAndScopeId(BudgetScopeType scopeType, Long scopeId);
}

