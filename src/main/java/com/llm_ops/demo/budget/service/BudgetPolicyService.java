package com.llm_ops.demo.budget.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.llm_ops.demo.budget.domain.BudgetPolicy;
import com.llm_ops.demo.budget.domain.BudgetScopeType;
import com.llm_ops.demo.budget.dto.BudgetPolicyUpdateRequest;
import com.llm_ops.demo.budget.repository.BudgetPolicyRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import java.util.Collections;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BudgetPolicyService {

    private static final TypeReference<Map<String, String>> MAP_STRING_STRING = new TypeReference<>() {
    };

    private final BudgetPolicyRepository budgetPolicyRepository;
    private final ObjectMapper objectMapper;

    public BudgetPolicyService(BudgetPolicyRepository budgetPolicyRepository, ObjectMapper objectMapper) {
        this.budgetPolicyRepository = budgetPolicyRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public Optional<BudgetPolicy> findPolicy(BudgetScopeType scopeType, Long scopeId) {
        if (scopeType == null || scopeId == null || scopeId <= 0) {
            return Optional.empty();
        }
        return budgetPolicyRepository.findByScopeTypeAndScopeId(scopeType, scopeId);
    }

    @Transactional
    public BudgetPolicy upsertPolicy(BudgetScopeType scopeType, Long scopeId, BudgetPolicyUpdateRequest request) {
        if (scopeType == null || scopeId == null || scopeId <= 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "scopeType/scopeId가 올바르지 않습니다.");
        }
        BudgetPolicy policy = budgetPolicyRepository
            .findByScopeTypeAndScopeId(scopeType, scopeId)
            .orElseGet(() -> BudgetPolicy.createDefault(scopeType, scopeId));

        String degradeMapJson = toJsonOrEmpty(request.degradeProviderModelMap());
        policy.update(
            request.monthLimitUsd(),
            request.softLimitUsd(),
            request.softAction(),
            degradeMapJson,
            request.degradeMaxOutputTokens(),
            request.degradeDisableRag(),
            request.enabled()
        );
        return budgetPolicyRepository.save(policy);
    }

    public Map<String, String> parseDegradeProviderModelMapOrEmpty(BudgetPolicy policy) {
        if (policy == null) {
            return Collections.emptyMap();
        }
        String raw = policy.getDegradeProviderModelMap();
        if (raw == null || raw.isBlank()) {
            return Collections.emptyMap();
        }
        try {
            return objectMapper.readValue(raw, MAP_STRING_STRING);
        } catch (Exception e) {
            return Collections.emptyMap();
        }
    }

    private String toJsonOrEmpty(Map<String, String> map) {
        if (map == null || map.isEmpty()) {
            return "{}";
        }
        try {
            return objectMapper.writeValueAsString(map);
        } catch (Exception e) {
            return "{}";
        }
    }
}

