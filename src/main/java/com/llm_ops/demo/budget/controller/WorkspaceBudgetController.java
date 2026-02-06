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
import com.llm_ops.demo.workspace.service.WorkspaceAccessService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}")
@Validated
public class WorkspaceBudgetController {

    private final WorkspaceAccessService workspaceAccessService;
    private final BudgetPolicyService budgetPolicyService;
    private final BudgetUsageService budgetUsageService;

    public WorkspaceBudgetController(
        WorkspaceAccessService workspaceAccessService,
        BudgetPolicyService budgetPolicyService,
        BudgetUsageService budgetUsageService
    ) {
        this.workspaceAccessService = workspaceAccessService;
        this.budgetPolicyService = budgetPolicyService;
        this.budgetUsageService = budgetUsageService;
    }

    @GetMapping("/budget-policy")
    public ResponseEntity<BudgetPolicyResponse> getBudgetPolicy(
        @PathVariable @NotNull @Positive Long workspaceId,
        @AuthenticationPrincipal @NotNull @Positive Long userId
    ) {
        workspaceAccessService.validateWorkspaceAccess(workspaceId, userId);

        BudgetPolicy policy = budgetPolicyService
            .findPolicy(BudgetScopeType.WORKSPACE, workspaceId)
            .orElseGet(() -> {
                BudgetPolicy p = BudgetPolicy.createDefault(BudgetScopeType.WORKSPACE, workspaceId);
                p.update(null, null, p.getSoftAction(), p.getDegradeProviderModelMap(), p.getDegradeMaxOutputTokens(), p.getDegradeDisableRag(), false);
                return p;
            });

        Map<String, String> map = budgetPolicyService.parseDegradeProviderModelMapOrEmpty(policy);
        return ResponseEntity.ok(BudgetPolicyResponse.from(policy, map));
    }

    @PutMapping("/budget-policy")
    public ResponseEntity<BudgetPolicyResponse> updateBudgetPolicy(
        @PathVariable @NotNull @Positive Long workspaceId,
        @AuthenticationPrincipal @NotNull @Positive Long userId,
        @RequestBody @Valid BudgetPolicyUpdateRequest request
    ) {
        workspaceAccessService.validateWorkspaceAccess(workspaceId, userId);

        BudgetPolicy policy = budgetPolicyService.upsertPolicy(BudgetScopeType.WORKSPACE, workspaceId, request);
        Map<String, String> map = budgetPolicyService.parseDegradeProviderModelMapOrEmpty(policy);
        return ResponseEntity.ok(BudgetPolicyResponse.from(policy, map));
    }

    @GetMapping("/budget-usage")
    public ResponseEntity<BudgetUsageResponse> getBudgetUsage(
        @PathVariable @NotNull @Positive Long workspaceId,
        @AuthenticationPrincipal @NotNull @Positive Long userId,
        @RequestParam(name = "month", required = false) String month
    ) {
        workspaceAccessService.validateWorkspaceAccess(workspaceId, userId);

        YearMonth ym = resolveYearMonthOrDefault(month);

        BudgetPolicy policy = budgetPolicyService.findPolicy(BudgetScopeType.WORKSPACE, workspaceId).orElse(null);
        BigDecimal hardLimit = policy != null && Boolean.TRUE.equals(policy.getEnabled()) ? policy.getMonthLimitUsd() : null;
        BigDecimal softLimit = policy != null && Boolean.TRUE.equals(policy.getEnabled()) ? policy.getSoftLimitUsd() : null;

        var usage = budgetUsageService.findUsage(BudgetScopeType.WORKSPACE, workspaceId, ym).orElse(null);
        BigDecimal used = usage != null && usage.getCostUsd() != null ? usage.getCostUsd() : BigDecimal.ZERO;

        return ResponseEntity.ok(new BudgetUsageResponse(
            BudgetScopeType.WORKSPACE,
            workspaceId,
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

