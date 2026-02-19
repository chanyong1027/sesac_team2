package com.llm_ops.demo.keys.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.domain.ProviderCredential;
import com.llm_ops.demo.keys.repository.ProviderCredentialRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProviderCredentialVerificationService {

    private final ProviderCredentialRepository providerCredentialRepository;
    private final ProviderCredentialVerifier providerCredentialVerifier;

    @Async("logExecutor")
    @Transactional
    public void verifyAsync(Long credentialId, String apiKey) {
        ProviderCredential credential = providerCredentialRepository.findById(credentialId).orElse(null);
        if (credential == null) {
            return;
        }

        try {
            providerCredentialVerifier.verify(credential.getProvider(), apiKey);
            credential.markActive();
        } catch (BusinessException e) {
            if (isAuthFailure(e)) {
                credential.markInvalid();
            } else {
                credential.markVerifying();
            }
        } catch (Exception e) {
            credential.markVerifying();
        }

        providerCredentialRepository.save(credential);
    }

    private boolean isAuthFailure(BusinessException exception) {
        ErrorCode code = exception.getErrorCode();
        return code == ErrorCode.UNAUTHENTICATED
                || code == ErrorCode.FORBIDDEN
                || code == ErrorCode.INVALID_INPUT_VALUE
                || code == ErrorCode.NOT_FOUND;
    }
}
