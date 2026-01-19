package com.llm_ops.demo.gateway.service;

import com.llm_ops.demo.gateway.dto.GatewayChatRequest;
import com.llm_ops.demo.keys.domain.ProviderType;
import org.springframework.stereotype.Service;

@Service
public class GatewayChatProviderResolveService {

    public ProviderType resolve(Long organizationId, GatewayChatRequest request) {
        // TODO: Replace with prompt version primaryModelConfig.provider lookup.
        return ProviderType.OPENAI;
    }
}
