package com.llm_ops.demo.budget.controller;

import com.llm_ops.demo.budget.domain.BudgetPolicy;
import com.llm_ops.demo.budget.domain.BudgetScopeType;
import com.llm_ops.demo.budget.dto.BudgetPolicyResponse;
import com.llm_ops.demo.budget.dto.BudgetPolicyUpdateRequest;
import com.llm_ops.demo.budget.dto.BudgetUsageResponse;
import com.llm_ops.demo.budget.service.BudgetPolicyService;
import com.llm_ops.demo.budget.service.BudgetUsageService;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.keys.service.ProviderCredentialService;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/organizations/{orgId}/providers/{provider}")
public class ProviderBudgetController {

    private final ProviderCredentialService providerCredentialService;
    private final BudgetPolicyService budgetPolicyService;
    private final BudgetUsageService budgetUsageService;

    public ProviderBudgetController(
        ProviderCredentialService providerCredentialService,
        BudgetPolicyService budgetPolicyService,
        BudgetUsageService budgetUsageService
    ) {
        this.providerCredentialService = providerCredentialService;
        this.budgetPolicyService = budgetPolicyService;
        this.budgetUsageService = budgetUsageService;
    }

    @GetMapping("/budget-policy")
    public ResponseEntity<BudgetPolicyResponse> getBudgetPolicy(
        @PathVariable("orgId") Long organizationId,
        @PathVariable("provider") String provider
    ) {
        ProviderType providerType = ProviderType.from(provider);
        Long credentialId = providerCredentialService.resolveCredentialId(organizationId, providerType);

        BudgetPolicy policy = budgetPolicyService
            .findPolicy(BudgetScopeType.PROVIDER_CREDENTIAL, credentialId)
            .orElseGet(() -> {
                BudgetPolicy p = BudgetPolicy.createDefault(BudgetScopeType.PROVIDER_CREDENTIAL, credentialId);
                p.update(null, null, p.getSoftAction(), p.getDegradeProviderModelMap(), p.getDegradeMaxOutputTokens(), p.getDegradeDisableRag(), false);
                return p;
            });

        Map<String, String> map = budgetPolicyService.parseDegradeProviderModelMapOrEmpty(policy);
        return ResponseEntity.ok(BudgetPolicyResponse.from(policy, map));
    }

    @PutMapping("/budget-policy")
    public ResponseEntity<BudgetPolicyResponse> updateBudgetPolicy(
        @PathVariable("orgId") Long organizationId,
        @PathVariable("provider") String provider,
        @RequestBody @Valid BudgetPolicyUpdateRequest request
    ) {
        ProviderType providerType = ProviderType.from(provider);
        Long credentialId = providerCredentialService.resolveCredentialId(organizationId, providerType);

        BudgetPolicy policy = budgetPolicyService.upsertPolicy(BudgetScopeType.PROVIDER_CREDENTIAL, credentialId, request);
        Map<String, String> map = budgetPolicyService.parseDegradeProviderModelMapOrEmpty(policy);
        return ResponseEntity.ok(BudgetPolicyResponse.from(policy, map));
    }

    @GetMapping("/budget-usage")
    public ResponseEntity<BudgetUsageResponse> getBudgetUsage(
        @PathVariable("orgId") Long organizationId,
        @PathVariable("provider") String provider,
        @RequestParam(name = "month", required = false) String month
    ) {
        ProviderType providerType = ProviderType.from(provider);
        Long credentialId = providerCredentialService.resolveCredentialId(organizationId, providerType);

        YearMonth ym = resolveYearMonthOrDefault(month);

        BudgetPolicy policy = budgetPolicyService.findPolicy(BudgetScopeType.PROVIDER_CREDENTIAL, credentialId).orElse(null);
        BigDecimal hardLimit = policy != null && Boolean.TRUE.equals(policy.getEnabled()) ? policy.getMonthLimitUsd() : null;
        BigDecimal softLimit = policy != null && Boolean.TRUE.equals(policy.getEnabled()) ? policy.getSoftLimitUsd() : null;

        var usage = budgetUsageService.findUsage(BudgetScopeType.PROVIDER_CREDENTIAL, credentialId, ym).orElse(null);
        BigDecimal used = usage != null && usage.getCostUsd() != null ? usage.getCostUsd() : BigDecimal.ZERO;

        return ResponseEntity.ok(new BudgetUsageResponse(
            BudgetScopeType.PROVIDER_CREDENTIAL,
            credentialId,
            BudgetUsageService.toYearMonthString(ym),
            used,
            hardLimit,
            softLimit,
            hardLimit != null ? hardLimit.subtract(used) : null,
            softLimit != null ? softLimit.subtract(used) : null,
            usage != null ? usage.getRequestCount() : 0L,
            usage != null ? usage.getTotalTokens() : 0L,
            usage != null ? usage.getUpdatedAt() : null
        ));
    }

    private YearMonth resolveYearMonthOrDefault(String month) {
        if (month == null || month.isBlank()) {
            return budgetUsageService.currentUtcYearMonth();
        }
        try {
            return YearMonth.parse(month.trim());
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "month는 YYYY-MM 형식이어야 합니다.");
        }
    }
}

