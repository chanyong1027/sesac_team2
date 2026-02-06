package com.llm_ops.demo.keys.service;

import com.llm_ops.demo.keys.domain.ProviderType;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Service
@Profile("test")
public class NoopProviderCredentialVerifier implements ProviderCredentialVerifier {
    @Override
    public void verify(ProviderType providerType, String apiKey) {
        // 테스트 환경에서는 외부 검증을 수행하지 않습니다.
    }
}
