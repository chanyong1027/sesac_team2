package com.llm_ops.demo.budget.service;

import com.llm_ops.demo.budget.domain.BudgetMonthlyUsage;
import com.llm_ops.demo.budget.domain.BudgetPolicy;
import com.llm_ops.demo.budget.domain.BudgetScopeType;
import com.llm_ops.demo.budget.domain.BudgetSoftAction;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BudgetGuardrailServiceTest {

    @Mock
    private BudgetPolicyService budgetPolicyService;

    @Mock
    private BudgetUsageService budgetUsageService;

    @InjectMocks
    private BudgetGuardrailService budgetGuardrailService;

    @Test
    @DisplayName("Provider credential 월 사용량이 하드리밋 이상이면 BLOCK을 반환한다")
    void provider_월_사용량이_하드리밋_이상이면_BLOCK을_반환한다() {
        // given
        Long credentialId = 10L;
        YearMonth ym = YearMonth.of(2026, 2);
        BudgetPolicy policy = BudgetPolicy.createDefault(BudgetScopeType.PROVIDER_CREDENTIAL, credentialId);
        policy.update(new BigDecimal("50.00"), null, null, null, null, null, true);
        BudgetMonthlyUsage usage = BudgetMonthlyUsage.create(BudgetScopeType.PROVIDER_CREDENTIAL, credentialId, 202602);
        usage.addUsage(new BigDecimal("50.00"), 100L, 1L);

        when(budgetPolicyService.findPolicy(BudgetScopeType.PROVIDER_CREDENTIAL, credentialId))
            .thenReturn(Optional.of(policy));
        when(budgetUsageService.currentUtcYearMonth()).thenReturn(ym);
        when(budgetUsageService.findUsage(BudgetScopeType.PROVIDER_CREDENTIAL, credentialId, ym))
            .thenReturn(Optional.of(usage));

        // when
        BudgetDecision decision = budgetGuardrailService.evaluateProviderCredential(credentialId);

        // then
        assertThat(decision.action()).isEqualTo(BudgetDecisionAction.BLOCK);
        assertThat(decision.scopeType()).isEqualTo(BudgetScopeType.PROVIDER_CREDENTIAL);
        assertThat(decision.scopeId()).isEqualTo(credentialId);
        assertThat(decision.reason()).isEqualTo("PROVIDER_BUDGET_EXCEEDED");
    }

    @Test
    @DisplayName("Provider credential 월 사용량이 하드리밋 미만이면 ALLOW를 반환한다")
    void provider_월_사용량이_하드리밋_미만이면_ALLOW를_반환한다() {
        // given
        Long credentialId = 10L;
        YearMonth ym = YearMonth.of(2026, 2);
        BudgetPolicy policy = BudgetPolicy.createDefault(BudgetScopeType.PROVIDER_CREDENTIAL, credentialId);
        policy.update(new BigDecimal("50.00"), null, null, null, null, null, true);
        BudgetMonthlyUsage usage = BudgetMonthlyUsage.create(BudgetScopeType.PROVIDER_CREDENTIAL, credentialId, 202602);
        usage.addUsage(new BigDecimal("49.99"), 100L, 1L);

        when(budgetPolicyService.findPolicy(BudgetScopeType.PROVIDER_CREDENTIAL, credentialId))
            .thenReturn(Optional.of(policy));
        when(budgetUsageService.currentUtcYearMonth()).thenReturn(ym);
        when(budgetUsageService.findUsage(BudgetScopeType.PROVIDER_CREDENTIAL, credentialId, ym))
            .thenReturn(Optional.of(usage));

        // when
        BudgetDecision decision = budgetGuardrailService.evaluateProviderCredential(credentialId);

        // then
        assertThat(decision.action()).isEqualTo(BudgetDecisionAction.ALLOW);
    }

    @Test
    @DisplayName("Workspace 월 사용량이 soft-limit 이상이면 DEGRADE를 반환한다")
    void workspace_월_사용량이_soft_limit_이상이면_DEGRADE를_반환한다() {
        // given
        Long workspaceId = 7L;
        String providerKey = "openai";
        YearMonth ym = YearMonth.of(2026, 2);
        BudgetPolicy policy = BudgetPolicy.createDefault(BudgetScopeType.WORKSPACE, workspaceId);
        policy.update(null, new BigDecimal("10.00"), BudgetSoftAction.DEGRADE, "{}", 256, true, true);
        BudgetMonthlyUsage usage = BudgetMonthlyUsage.create(BudgetScopeType.WORKSPACE, workspaceId, 202602);
        usage.addUsage(new BigDecimal("10.00"), 500L, 2L);

        when(budgetPolicyService.findPolicy(BudgetScopeType.WORKSPACE, workspaceId))
            .thenReturn(Optional.of(policy));
        when(budgetUsageService.currentUtcYearMonth()).thenReturn(ym);
        when(budgetUsageService.findUsage(BudgetScopeType.WORKSPACE, workspaceId, ym))
            .thenReturn(Optional.of(usage));
        when(budgetPolicyService.parseDegradeProviderModelMapOrEmpty(policy))
            .thenReturn(Map.of("openai", "gpt-4o-mini"));

        // when
        BudgetDecision decision = budgetGuardrailService.evaluateWorkspaceDegrade(workspaceId, providerKey);

        // then
        assertThat(decision.action()).isEqualTo(BudgetDecisionAction.DEGRADE);
        assertThat(decision.scopeType()).isEqualTo(BudgetScopeType.WORKSPACE);
        assertThat(decision.scopeId()).isEqualTo(workspaceId);
        assertThat(decision.reason()).isEqualTo("WORKSPACE_SOFT_LIMIT_EXCEEDED");
        assertThat(decision.overrides().modelOverride()).isEqualTo("gpt-4o-mini");
        assertThat(decision.overrides().maxOutputTokens()).isEqualTo(256);
        assertThat(decision.overrides().disableRag()).isTrue();
    }

    @Test
    @DisplayName("Workspace 월 사용량이 soft-limit 미만이면 ALLOW를 반환한다")
    void workspace_월_사용량이_soft_limit_미만이면_ALLOW를_반환한다() {
        // given
        Long workspaceId = 7L;
        YearMonth ym = YearMonth.of(2026, 2);
        BudgetPolicy policy = BudgetPolicy.createDefault(BudgetScopeType.WORKSPACE, workspaceId);
        policy.update(null, new BigDecimal("10.00"), BudgetSoftAction.DEGRADE, "{}", 256, true, true);
        BudgetMonthlyUsage usage = BudgetMonthlyUsage.create(BudgetScopeType.WORKSPACE, workspaceId, 202602);
        usage.addUsage(new BigDecimal("9.99"), 500L, 2L);

        when(budgetPolicyService.findPolicy(BudgetScopeType.WORKSPACE, workspaceId))
            .thenReturn(Optional.of(policy));
        when(budgetUsageService.currentUtcYearMonth()).thenReturn(ym);
        when(budgetUsageService.findUsage(BudgetScopeType.WORKSPACE, workspaceId, ym))
            .thenReturn(Optional.of(usage));

        // when
        BudgetDecision decision = budgetGuardrailService.evaluateWorkspaceDegrade(workspaceId, "openai");

        // then
        assertThat(decision.action()).isEqualTo(BudgetDecisionAction.ALLOW);
        verify(budgetPolicyService, never()).parseDegradeProviderModelMapOrEmpty(eq(policy));
    }

    @Test
    @DisplayName("Workspace providerKey가 공백이어도 soft-limit 초과면 DEGRADE를 반환한다")
    void workspace_providerKey가_공백이어도_soft_limit_초과면_DEGRADE를_반환한다() {
        // given
        Long workspaceId = 7L;
        YearMonth ym = YearMonth.of(2026, 2);
        BudgetPolicy policy = BudgetPolicy.createDefault(BudgetScopeType.WORKSPACE, workspaceId);
        policy.update(null, new BigDecimal("10.00"), BudgetSoftAction.DEGRADE, "{}", 512, false, true);
        BudgetMonthlyUsage usage = BudgetMonthlyUsage.create(BudgetScopeType.WORKSPACE, workspaceId, 202602);
        usage.addUsage(new BigDecimal("11.00"), 500L, 2L);

        when(budgetPolicyService.findPolicy(BudgetScopeType.WORKSPACE, workspaceId))
            .thenReturn(Optional.of(policy));
        when(budgetUsageService.currentUtcYearMonth()).thenReturn(ym);
        when(budgetUsageService.findUsage(BudgetScopeType.WORKSPACE, workspaceId, ym))
            .thenReturn(Optional.of(usage));
        when(budgetPolicyService.parseDegradeProviderModelMapOrEmpty(policy))
            .thenReturn(Map.of("openai", "gpt-4o-mini"));

        // when
        BudgetDecision decision = budgetGuardrailService.evaluateWorkspaceDegrade(workspaceId, "  ");

        // then
        assertThat(decision.action()).isEqualTo(BudgetDecisionAction.DEGRADE);
        assertThat(decision.overrides().modelOverride()).isNull();
        assertThat(decision.overrides().maxOutputTokens()).isEqualTo(512);
        assertThat(decision.overrides().disableRag()).isFalse();
    }
}
