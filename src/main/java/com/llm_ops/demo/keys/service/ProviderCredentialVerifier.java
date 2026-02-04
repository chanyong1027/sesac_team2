package com.llm_ops.demo.keys.service;

import com.llm_ops.demo.keys.domain.ProviderType;

public interface ProviderCredentialVerifier {
    void verify(ProviderType providerType, String apiKey);
}
