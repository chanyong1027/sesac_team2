package com.llm_ops.demo.keys.util;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("ApiKeyGenerator 테스트")
class ApiKeyGeneratorTest {

    private ApiKeyGenerator apiKeyGenerator;

    @BeforeEach
    void setUp() {
        apiKeyGenerator = new ApiKeyGenerator();
    }

    @Test
    @DisplayName("생성된 API Key는 lum_ 접두사로 시작한다")
    void 생성된_API_Key는_lum_접두사로_시작한다() {
        // when
        String apiKey = apiKeyGenerator.generate();

        // then
        assertThat(apiKey).startsWith("lum_");
    }

    @Test
    @DisplayName("생성된 API Key는 매번 다른 값이다")
    void 생성된_API_Key는_매번_다른_값이다() {
        // when
        String key1 = apiKeyGenerator.generate();
        String key2 = apiKeyGenerator.generate();

        // then
        assertThat(key1).isNotEqualTo(key2);
    }

    @Test
    @DisplayName("hash 메서드는 SHA-256 해시를 반환한다")
    void hash_메서드는_SHA256_해시를_반환한다() throws Exception {
        // given
        String value = "test-api-key";

        // when
        String hash = apiKeyGenerator.hash(value);

        // then
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] expectedHash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
        StringBuilder expected = new StringBuilder(expectedHash.length * 2);
        for (byte b : expectedHash) {
            expected.append(String.format("%02x", b));
        }

        assertThat(hash).isEqualTo(expected.toString());
        assertThat(hash).hasSize(64);
    }

    @Test
    @DisplayName("동일한 값에 대해 동일한 해시를 반환한다")
    void 동일한_값에_대해_동일한_해시를_반환한다() {
        // given
        String value = "test-api-key";

        // when
        String hash1 = apiKeyGenerator.hash(value);
        String hash2 = apiKeyGenerator.hash(value);

        // then
        assertThat(hash1).isEqualTo(hash2);
    }

    @Test
    @DisplayName("extractPrefix는 앞 12자리를 반환한다")
    void extractPrefix는_앞_12자리를_반환한다() {
        // given
        String apiKey = "lum_abc123xyz456789";

        // when
        String prefix = apiKeyGenerator.extractPrefix(apiKey);

        // then
        assertThat(prefix).isEqualTo("lum_abc123xy");
        assertThat(prefix).hasSize(12);
    }

    @Test
    @DisplayName("generateWithHash는 원문, 해시, prefix를 모두 반환한다")
    void generateWithHash는_원문_해시_prefix를_모두_반환한다() {
        // when
        ApiKeyGenerator.GeneratedKey generatedKey = apiKeyGenerator.generateWithHash();

        // then
        assertThat(generatedKey.plaintext()).startsWith("lum_");
        assertThat(generatedKey.hash()).hasSize(64);
        assertThat(generatedKey.prefix()).hasSize(12);
        assertThat(generatedKey.plaintext()).startsWith(generatedKey.prefix());
    }

    @Test
    @DisplayName("generateWithHash의 hash는 plaintext의 실제 해시값이다")
    void generateWithHash의_hash는_plaintext의_실제_해시값이다() {
        // when
        ApiKeyGenerator.GeneratedKey generatedKey = apiKeyGenerator.generateWithHash();

        // then
        String expectedHash = apiKeyGenerator.hash(generatedKey.plaintext());
        assertThat(generatedKey.hash()).isEqualTo(expectedHash);
    }
}
