package com.llm_ops.demo.keys.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.domain.OrganizationApiKey;
import com.llm_ops.demo.keys.domain.OrganizationApiKeyStatus;
import com.llm_ops.demo.keys.repository.OrganizationApiKeyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

/**
 * X-API-Key 헤더를 통해 전달된 API 키를 인증하고, 해당하는 조직 ID를 반환하는 서비스입니다.
 * 게이트웨이의 핵심 인증 로직을 담당합니다.
 */
@Service
@RequiredArgsConstructor
public class OrganizationApiKeyAuthService {

    private static final int KEY_PREFIX_LENGTH = 12;

    private final OrganizationApiKeyRepository organizationApiKeyRepository;

    public record AuthResult(
            Long organizationId,
            Long apiKeyId,
            String apiKeyPrefix
    ) {
    }

    /**
     * 전달된 API 키의 유효성을 검증하고, 키에 연결된 조직(Organization)의 ID를 반환합니다.
     * <p>
     * 인증 절차:
     * 1. API 키의 접두사(prefix)를 추출합니다.
     * 2. 접두사와 일치하는 모든 키 후보를 DB에서 조회합니다.
     * 3. 후보 키들 중에서 API 키 전체의 해시값과 일치하고, 상태가 ACTIVE인 키를 찾습니다.
     * 4. 유효한 키를 찾으면 해당 조직 ID를 반환하고, 그렇지 않으면 인증 실패 예외를 발생시킵니다.
     *
     * @param apiKey X-API-Key 헤더로 받은 실제 API 키 문자열
     * @return 인증 성공 시, 해당 API 키가 속한 조직의 ID
     * @throws BusinessException API 키가 없거나 유효하지 않을 경우
     */
    @Transactional(readOnly = true)
    public Long resolveOrganizationId(String apiKey) {
        return resolveAuthResult(apiKey).organizationId();
    }

    @Transactional(readOnly = true)
    public AuthResult resolveAuthResult(String apiKey) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new BusinessException(ErrorCode.UNAUTHENTICATED, "API Key가 필요합니다.");
        }

        String keyPrefix = apiKey.substring(0, Math.min(KEY_PREFIX_LENGTH, apiKey.length()));
        String keyHash = sha256Hex(apiKey);

        List<OrganizationApiKey> candidates = organizationApiKeyRepository.findAllByKeyPrefix(keyPrefix);
        OrganizationApiKey matched = candidates.stream()
                .filter(apiKeyEntity -> apiKeyEntity.getStatus() == OrganizationApiKeyStatus.ACTIVE)
                .filter(apiKeyEntity -> apiKeyEntity.getKeyHash().equals(keyHash))
                .findFirst()
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHENTICATED, "유효하지 않은 API Key 입니다."));

        return new AuthResult(
                matched.getOrganizationId(),
                matched.getId(),
                matched.getKeyPrefix()
        );
    }

    /**
     * 주어진 문자열을 SHA-256 알고리즘으로 해싱하여 16진수 문자열로 반환합니다.
     */
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
