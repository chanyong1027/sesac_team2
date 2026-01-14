package com.llm_ops.demo.keys.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.global.util.ProviderKeyEncryptor;
import com.llm_ops.demo.keys.domain.ProviderCredential;
import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.keys.dto.ProviderCredentialCreateRequest;
import com.llm_ops.demo.keys.dto.ProviderCredentialCreateResponse;
import com.llm_ops.demo.keys.dto.ProviderCredentialSummaryResponse;
import com.llm_ops.demo.keys.repository.ProviderCredentialRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ProviderCredentialService {

    private final ProviderCredentialRepository providerCredentialRepository;
    private final ProviderKeyEncryptor providerKeyEncryptor;

    @Transactional
    public ProviderCredentialCreateResponse register(
            Long workspaceId,
            ProviderCredentialCreateRequest request
    ) {
        ProviderType providerType = ProviderType.from(request.getProvider());

        // TODO: enforce OWNER-only access once auth is implemented.
        // TODO: validate workspace existence once workspace domain is available.

        if (providerCredentialRepository.existsByWorkspaceIdAndProvider(workspaceId, providerType)) {
            throw new BusinessException(ErrorCode.CONFLICT, "이미 등록된 provider 입니다.");
        }

        String ciphertext = providerKeyEncryptor.encrypt(request.getApiKey());
        ProviderCredential credential = ProviderCredential.create(
                workspaceId,
                providerType,
                ciphertext
        );

        ProviderCredential saved = providerCredentialRepository.save(credential);
        return ProviderCredentialCreateResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<ProviderCredentialSummaryResponse> getProviderCredentials(Long workspaceId) {
        // TODO: enforce MEMBER+ access once auth is implemented.
        // TODO: validate workspace existence once workspace domain is available.
        return providerCredentialRepository.findAllByWorkspaceId(workspaceId).stream()
                .map(ProviderCredentialSummaryResponse::from)
                .toList();
    }
}
