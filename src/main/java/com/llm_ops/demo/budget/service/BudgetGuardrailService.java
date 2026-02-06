package com.llm_ops.demo.budget.service;

import com.llm_ops.demo.budget.domain.BudgetPolicy;
import com.llm_ops.demo.budget.domain.BudgetScopeType;
import com.llm_ops.demo.budget.domain.BudgetSoftAction;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class BudgetGuardrailService {

    private final BudgetPolicyService budgetPolicyService;
    private final BudgetUsageService budgetUsageService;

    public BudgetGuardrailService(BudgetPolicyService budgetPolicyService, BudgetUsageService budgetUsageService) {
        this.budgetPolicyService = budgetPolicyService;
        this.budgetUsageService = budgetUsageService;
    }

    public BudgetDecision evaluateProviderCredential(Long providerCredentialId) {
        if (providerCredentialId == null || providerCredentialId <= 0) {
            return BudgetDecision.allow();
        }

        BudgetPolicy policy = budgetPolicyService
            .findPolicy(BudgetScopeType.PROVIDER_CREDENTIAL, providerCredentialId)
            .filter(p -> Boolean.TRUE.equals(p.getEnabled()))
            .orElse(null);
        if (policy == null || policy.getMonthLimitUsd() == null) {
            return BudgetDecision.allow();
        }

        YearMonth ym = budgetUsageService.currentUtcYearMonth();
        BigDecimal used = budgetUsageService
            .findUsage(BudgetScopeType.PROVIDER_CREDENTIAL, providerCredentialId, ym)
            .map(u -> u.getCostUsd())
            .orElse(BigDecimal.ZERO);

        if (used.compareTo(policy.getMonthLimitUsd()) >= 0) {
            return new BudgetDecision(
                BudgetDecisionAction.BLOCK,
                BudgetScopeType.PROVIDER_CREDENTIAL,
                providerCredentialId,
                "PROVIDER_BUDGET_EXCEEDED",
                new BudgetDecision.Overrides(null, null, null)
            );
        }

        return BudgetDecision.allow();
    }

    public BudgetDecision evaluateWorkspaceDegrade(Long workspaceId, String providerKeyLowercase) {
        if (workspaceId == null || workspaceId <= 0) {
            return BudgetDecision.allow();
        }

        BudgetPolicy policy = budgetPolicyService
            .findPolicy(BudgetScopeType.WORKSPACE, workspaceId)
            .filter(p -> Boolean.TRUE.equals(p.getEnabled()))
            .orElse(null);
        if (policy == null || policy.getSoftLimitUsd() == null) {
            return BudgetDecision.allow();
        }

        YearMonth ym = budgetUsageService.currentUtcYearMonth();
        BigDecimal used = budgetUsageService
            .findUsage(BudgetScopeType.WORKSPACE, workspaceId, ym)
            .map(u -> u.getCostUsd())
            .orElse(BigDecimal.ZERO);

        if (used.compareTo(policy.getSoftLimitUsd()) < 0) {
            return BudgetDecision.allow();
        }

        if (policy.getSoftAction() != null && policy.getSoftAction() != BudgetSoftAction.DEGRADE) {
            return BudgetDecision.allow();
        }

        Map<String, String> map = budgetPolicyService.parseDegradeProviderModelMapOrEmpty(policy);
        String modelOverride = null;
        if (providerKeyLowercase != null && !providerKeyLowercase.isBlank()) {
            modelOverride = map.get(providerKeyLowercase);
        }

        return new BudgetDecision(
            BudgetDecisionAction.DEGRADE,
            BudgetScopeType.WORKSPACE,
            workspaceId,
            "WORKSPACE_SOFT_LIMIT_EXCEEDED",
            new BudgetDecision.Overrides(
                modelOverride,
                policy.getDegradeMaxOutputTokens(),
                policy.getDegradeDisableRag()
            )
        );
    }
}
