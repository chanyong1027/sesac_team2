package com.llm_ops.demo.keys.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.domain.OrganizationApiKey;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateRequest;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateResponse;
import com.llm_ops.demo.keys.repository.OrganizationApiKeyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

@Service
@RequiredArgsConstructor
public class OrganizationApiKeyCreateService {

    private static final String KEY_PREFIX = "lum_";
    private static final int RANDOM_BYTES = 32;
    private static final int KEY_PREFIX_LENGTH = 12;

    private final OrganizationApiKeyRepository organizationApiKeyRepository;
    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional
    public OrganizationApiKeyCreateResponse create(Long organizationId, OrganizationApiKeyCreateRequest request) {
        validateNameUnique(organizationId, request.name());

        String plaintextApiKey = generateApiKey();
        String keyHash = sha256Hex(plaintextApiKey);
        String keyPrefix = plaintextApiKey.substring(0, Math.min(KEY_PREFIX_LENGTH, plaintextApiKey.length()));

        organizationApiKeyRepository.save(
                OrganizationApiKey.create(organizationId, request.name(), keyHash, keyPrefix)
        );

        return new OrganizationApiKeyCreateResponse(plaintextApiKey);
    }

    private void validateNameUnique(Long organizationId, String name) {
        if (organizationApiKeyRepository.existsByOrganizationIdAndName(organizationId, name)) {
            throw new BusinessException(ErrorCode.CONFLICT, "이미 존재하는 API Key 이름입니다.");
        }
    }

    private String generateApiKey() {
        byte[] randomBytes = new byte[RANDOM_BYTES];
        secureRandom.nextBytes(randomBytes);
        String encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
        return KEY_PREFIX + encoded;
    }

    private String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                builder.append(String.format("%02x", b));
            }
            return builder.toString();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to hash api key", e);
        }
    }
}
