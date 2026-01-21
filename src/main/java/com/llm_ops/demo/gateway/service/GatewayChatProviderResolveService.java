package com.llm_ops.demo.gateway.service;

import com.llm_ops.demo.gateway.dto.GatewayChatRequest;
import com.llm_ops.demo.gateway.config.GatewayPromptProviderProperties;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.domain.ProviderType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GatewayChatProviderResolveService {

    private final GatewayPromptProviderProperties gatewayPromptProviderProperties;

    public ProviderType resolve(Long organizationId, GatewayChatRequest request) {
        String provider = gatewayPromptProviderProperties.getPromptProviders().stream()
                .filter(mapping -> request.promptKey().equals(mapping.getPromptKey()))
                .map(GatewayPromptProviderProperties.PromptProviderMapping::getProvider)
                .findFirst()
                .orElse(null);
        if (provider == null || provider.isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "promptKey에 대한 provider 설정이 없습니다.");
        }
        return ProviderType.from(provider);
    }
}
