package com.llm_ops.demo.prompt.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.prompt.config.PromptModelAllowlistProperties;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class PromptModelAllowlistService {

    private final PromptModelAllowlistProperties properties;

    public PromptModelAllowlistService(PromptModelAllowlistProperties properties) {
        this.properties = properties;
    }

    public void validateModel(ProviderType provider, String model) {
        if (provider == null || model == null || model.isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "지원하지 않는 모델입니다.");
        }

        Set<String> allowed = getNormalizedAllowlist(provider);
        String normalizedModel = normalize(model);

        if (allowed.isEmpty() || !allowed.contains(normalizedModel)) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "지원하지 않는 모델입니다.");
        }
    }

    public Map<String, List<String>> getAllowlist() {
        Map<String, List<String>> result = new LinkedHashMap<>();
        Map<String, List<String>> raw = properties.getModelAllowlist();

        for (ProviderType provider : ProviderType.values()) {
            List<String> models = raw.getOrDefault(provider.getValue(), List.of());
            List<String> trimmed = new ArrayList<>();
            for (String model : models) {
                if (model == null) {
                    continue;
                }
                String value = model.trim();
                if (!value.isBlank()) {
                    trimmed.add(value);
                }
            }
            result.put(provider.name(), trimmed);
        }

        return result;
    }

    private Set<String> getNormalizedAllowlist(ProviderType provider) {
        Map<String, List<String>> raw = properties.getModelAllowlist();
        List<String> models = raw.getOrDefault(provider.getValue(), List.of());
        Set<String> normalized = new LinkedHashSet<>();
        for (String model : models) {
            if (model == null) {
                continue;
            }
            String value = normalize(model);
            if (!value.isBlank()) {
                normalized.add(value);
            }
        }
        return normalized;
    }

    private String normalize(String value) {
        return value.trim().toLowerCase(Locale.ROOT);
    }
}
