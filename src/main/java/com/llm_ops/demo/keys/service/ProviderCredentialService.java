package com.llm_ops.demo.keys.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.global.util.ProviderKeyEncryptor;
import com.llm_ops.demo.keys.domain.ProviderCredential;
import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.keys.dto.ProviderCredentialCreateRequest;
import com.llm_ops.demo.keys.dto.ProviderCredentialCreateResponse;
import com.llm_ops.demo.keys.dto.ProviderCredentialSummaryResponse;
import com.llm_ops.demo.keys.dto.ProviderCredentialUpdateRequest;
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
            Long organizationId,
            ProviderCredentialCreateRequest request
    ) {
        ProviderType providerType = ProviderType.from(request.provider());

        // TODO: enforce OWNER-only access once auth is implemented.
        // TODO: validate organization existence once organization domain is available.

        validateDuplicate(organizationId, providerType);

        String ciphertext = providerKeyEncryptor.encrypt(request.apiKey());
        ProviderCredential credential = ProviderCredential.create(
                organizationId,
                providerType,
                ciphertext
        );

        ProviderCredential saved = providerCredentialRepository.save(credential);
        return ProviderCredentialCreateResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<ProviderCredentialSummaryResponse> getProviderCredentials(Long organizationId) {
        // TODO: enforce MEMBER+ access once auth is implemented.
        // TODO: validate organization existence once organization domain is available.
        return providerCredentialRepository.findAllByOrganizationId(organizationId).stream()
                .map(ProviderCredentialSummaryResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public String getDecryptedApiKey(Long organizationId, ProviderType providerType) {
        ProviderCredential credential = providerCredentialRepository
                .findByOrganizationIdAndProvider(organizationId, providerType)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "등록된 provider key가 없습니다."));
        return providerKeyEncryptor.decrypt(credential.getKeyCiphertext());
    }

    @Transactional
    public ProviderCredentialCreateResponse update(
            Long organizationId,
            Long credentialId,
            ProviderCredentialUpdateRequest request
    ) {
        if (credentialId == null || credentialId <= 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT_VALUE, "credentialId가 올바르지 않습니다.");
        }

        ProviderCredential credential = providerCredentialRepository.findById(credentialId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "등록된 provider key가 없습니다."));

        if (!credential.getOrganizationId().equals(organizationId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "조직에 대한 권한이 없습니다.");
        }

        String ciphertext = providerKeyEncryptor.encrypt(request.apiKey());
        credential.updateKey(ciphertext);
        ProviderCredential saved = providerCredentialRepository.save(credential);
        return ProviderCredentialCreateResponse.from(saved);
    }
    private void validateDuplicate(Long organizationId, ProviderType providerType) {
        if (providerCredentialRepository.existsByOrganizationIdAndProvider(organizationId, providerType)) {
            throw new BusinessException(ErrorCode.CONFLICT, "이미 등록된 provider 입니다.");
        }
    }
}
