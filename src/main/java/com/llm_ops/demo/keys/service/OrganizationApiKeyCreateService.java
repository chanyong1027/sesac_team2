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

/**
 * {@link OrganizationApiKey}를 생성하는 비즈니스 로직을 담당하는 서비스 클래스입니다.
 * '단일 책임 원칙'에 따라 키 생성과 관련된 모든 처리를 담당합니다.
 */
@Service
@RequiredArgsConstructor
public class OrganizationApiKeyCreateService {

    private static final String KEY_PREFIX = "lum_";
    private static final int RANDOM_BYTES = 32;
    private static final int KEY_PREFIX_LENGTH = 12;

    private final OrganizationApiKeyRepository organizationApiKeyRepository;
    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * 새로운 조직 API 키를 생성하고 데이터베이스에 저장합니다.
     * 생성된 키의 실제 값은 이 메서드의 반환 값에서만 한 번 노출됩니다.
     *
     * @param organizationId API 키를 생성할 조직의 ID
     * @param request        API 키 생성 요청 정보
     * @return 생성된 API 키의 실제 값이 포함된 응답 DTO
     */
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

    /**
     * 조직 내에서 API 키의 이름이 고유한지 검증합니다.
     */
    private void validateNameUnique(Long organizationId, String name) {
        if (organizationApiKeyRepository.existsByOrganizationIdAndName(organizationId, name)) {
            throw new BusinessException(ErrorCode.CONFLICT, "이미 존재하는 API Key 이름입니다.");
        }
    }

    /**
     * 보안적으로 안전한 랜덤 API 키를 생성합니다.
     * 형식: "lum_" + Base64(32-byte random)
     */
    private String generateApiKey() {
        byte[] randomBytes = new byte[RANDOM_BYTES];
        secureRandom.nextBytes(randomBytes);
        String encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
        return KEY_PREFIX + encoded;
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
