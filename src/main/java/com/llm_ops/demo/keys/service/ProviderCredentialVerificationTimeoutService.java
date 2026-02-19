package com.llm_ops.demo.keys.service;

import com.llm_ops.demo.keys.domain.ProviderCredential;
import com.llm_ops.demo.keys.domain.ProviderCredentialStatus;
import com.llm_ops.demo.keys.repository.ProviderCredentialRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProviderCredentialVerificationTimeoutService {

    private static final Duration VERIFY_TIMEOUT = Duration.ofMinutes(10);

    private final ProviderCredentialRepository providerCredentialRepository;

    @Scheduled(fixedDelayString = "60000")
    @Transactional
    public void markExpiredVerifications() {
        LocalDateTime cutoff = LocalDateTime.now().minus(VERIFY_TIMEOUT);
        List<ProviderCredential> stale = providerCredentialRepository
                .findAllByStatusAndUpdatedAtBefore(ProviderCredentialStatus.VERIFYING, cutoff);
        if (stale.isEmpty()) {
            return;
        }
        for (ProviderCredential credential : stale) {
            credential.markInvalid();
        }
        providerCredentialRepository.saveAll(stale);
    }
}
