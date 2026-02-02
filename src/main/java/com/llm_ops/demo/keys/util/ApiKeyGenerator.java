package com.llm_ops.demo.keys.util;

import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Organization API Key 생성 및 해싱을 담당하는 유틸리티 클래스입니다.
 * 키 생성, 해싱, prefix 추출 등의 공통 로직을 제공합니다.
 */
@Component
public class ApiKeyGenerator {

    private static final String KEY_PREFIX = "lum_";
    private static final int RANDOM_BYTES = 32;
    private static final int DEFAULT_PREFIX_LENGTH = 12;

    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * 보안적으로 안전한 랜덤 API 키를 생성합니다.
     * 형식: "lum_" + Base64URL(32-byte random)
     *
     * @return 생성된 API 키 원문
     */
    public String generate() {
        byte[] randomBytes = new byte[RANDOM_BYTES];
        secureRandom.nextBytes(randomBytes);
        String encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
        return KEY_PREFIX + encoded;
    }

    /**
     * 주어진 문자열을 SHA-256 알고리즘으로 해싱합니다.
     *
     * @param value 해싱할 문자열
     * @return 64자리 16진수 해시 문자열
     */
    public String hash(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(hashBytes.length * 2);
            for (byte b : hashBytes) {
                builder.append(String.format("%02x", b));
            }
            return builder.toString();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to hash value", e);
        }
    }

    /**
     * API 키에서 prefix를 추출합니다.
     *
     * @param apiKey 원문 API 키
     * @return 키의 앞 12자리
     */
    public String extractPrefix(String apiKey) {
        return apiKey.substring(0, Math.min(DEFAULT_PREFIX_LENGTH, apiKey.length()));
    }

    /**
     * API 키 생성 결과를 담는 VO입니다.
     *
     * @param plaintext 원문 키 (1회 노출)
     * @param hash      SHA-256 해시
     * @param prefix    앞 12자리
     */
    public record GeneratedKey(
            String plaintext,
            String hash,
            String prefix
    ) {
    }

    /**
     * API 키를 생성하고 해시, prefix를 함께 반환합니다.
     *
     * @return 생성된 키 정보 (원문, 해시, prefix)
     */
    public GeneratedKey generateWithHash() {
        String plaintext = generate();
        String hash = hash(plaintext);
        String prefix = extractPrefix(plaintext);
        return new GeneratedKey(plaintext, hash, prefix);
    }
}
