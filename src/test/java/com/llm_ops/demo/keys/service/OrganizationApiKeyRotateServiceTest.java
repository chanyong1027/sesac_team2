package com.llm_ops.demo.keys.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.domain.OrganizationApiKey;
import com.llm_ops.demo.keys.domain.OrganizationApiKeyStatus;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateRequest;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateResponse;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyRotateRequest;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyRotateResponse;
import com.llm_ops.demo.keys.repository.OrganizationApiKeyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@DisplayName("OrganizationApiKeyRotateService 테스트")
class OrganizationApiKeyRotateServiceTest {

    @Autowired
    private OrganizationApiKeyRotateService organizationApiKeyRotateService;

    @Autowired
    private OrganizationApiKeyCreateService organizationApiKeyCreateService;

    @Autowired
    private OrganizationApiKeyRepository organizationApiKeyRepository;

    private Long organizationId;
    private OrganizationApiKey savedKey;
    private String originalKeyHash;

    @BeforeEach
    void setUp() {
        organizationApiKeyRepository.deleteAll();

        organizationId = 1L;
        OrganizationApiKeyCreateRequest createRequest = new OrganizationApiKeyCreateRequest("test-key");
        organizationApiKeyCreateService.create(organizationId, createRequest);

        savedKey = organizationApiKeyRepository.findAll().get(0);
        originalKeyHash = savedKey.getKeyHash();
    }

    @Test
    @DisplayName("API Key를 성공적으로 교체한다")
    void API_Key를_성공적으로_교체한다() throws Exception {
        // given
        OrganizationApiKeyRotateRequest request = new OrganizationApiKeyRotateRequest("보안 정책에 따른 정기 교체");

        // when
        OrganizationApiKeyRotateResponse response = organizationApiKeyRotateService.rotate(
                organizationId, savedKey.getId(), request
        );

        // then
        assertThat(response.apiKey()).startsWith("lum_");
        assertThat(response.rotatedAt()).isNotNull();

        OrganizationApiKey rotatedKey = organizationApiKeyRepository.findById(savedKey.getId()).orElseThrow();
        assertThat(rotatedKey.getKeyHash()).isNotEqualTo(originalKeyHash);
        assertThat(rotatedKey.getKeyPrefix()).isEqualTo(response.apiKey().substring(0, 12));

        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(response.apiKey().getBytes(StandardCharsets.UTF_8));
        StringBuilder hex = new StringBuilder(hash.length * 2);
        for (byte b : hash) {
            hex.append(String.format("%02x", b));
        }
        assertThat(rotatedKey.getKeyHash()).isEqualTo(hex.toString());
    }

    @Test
    @DisplayName("교체 후에도 동일한 keyId가 유지된다")
    void 교체_후에도_동일한_keyId가_유지된다() {
        // given
        Long originalKeyId = savedKey.getId();
        OrganizationApiKeyRotateRequest request = new OrganizationApiKeyRotateRequest("테스트");

        // when
        organizationApiKeyRotateService.rotate(organizationId, savedKey.getId(), request);

        // then
        assertThat(organizationApiKeyRepository.count()).isEqualTo(1);
        OrganizationApiKey rotatedKey = organizationApiKeyRepository.findAll().get(0);
        assertThat(rotatedKey.getId()).isEqualTo(originalKeyId);
    }

    @Test
    @DisplayName("존재하지 않는 Key 교체시 예외가 발생한다")
    void 존재하지_않는_Key_교체시_예외가_발생한다() {
        // given
        Long nonExistentKeyId = 9999L;
        OrganizationApiKeyRotateRequest request = new OrganizationApiKeyRotateRequest("테스트");

        // when & then
        assertThatThrownBy(() -> organizationApiKeyRotateService.rotate(organizationId, nonExistentKeyId, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> {
                    BusinessException businessException = (BusinessException) exception;
                    assertThat(businessException.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND);
                });
    }

    @Test
    @DisplayName("다른 조직의 Key 교체시 예외가 발생한다")
    void 다른_조직의_Key_교체시_예외가_발생한다() {
        // given
        Long otherOrganizationId = 999L;
        OrganizationApiKeyRotateRequest request = new OrganizationApiKeyRotateRequest("테스트");

        // when & then
        assertThatThrownBy(() -> organizationApiKeyRotateService.rotate(otherOrganizationId, savedKey.getId(), request))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> {
                    BusinessException businessException = (BusinessException) exception;
                    assertThat(businessException.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
                });
    }

    @Test
    @DisplayName("비활성화된 Key 교체시 예외가 발생한다")
    void 비활성화된_Key_교체시_예외가_발생한다() {
        // given
        OrganizationApiKey revokedKey = OrganizationApiKey.create(
                organizationId, "revoked-key", "hash123", "lum_prefix1"
        );
        // Reflection을 사용하여 status를 REVOKED로 변경
        setFieldValue(revokedKey, "status", OrganizationApiKeyStatus.REVOKED);
        organizationApiKeyRepository.save(revokedKey);

        OrganizationApiKeyRotateRequest request = new OrganizationApiKeyRotateRequest("테스트");

        // when & then
        assertThatThrownBy(() -> organizationApiKeyRotateService.rotate(organizationId, revokedKey.getId(), request))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> {
                    BusinessException businessException = (BusinessException) exception;
                    assertThat(businessException.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT_VALUE);
                });
    }

    @Test
    @DisplayName("reason 없이도 교체가 가능하다")
    void reason_없이도_교체가_가능하다() {
        // given
        OrganizationApiKeyRotateRequest request = new OrganizationApiKeyRotateRequest(null);

        // when
        OrganizationApiKeyRotateResponse response = organizationApiKeyRotateService.rotate(
                organizationId, savedKey.getId(), request
        );

        // then
        assertThat(response.apiKey()).startsWith("lum_");
    }

    private void setFieldValue(Object target, String fieldName, Object value) {
        try {
            java.lang.reflect.Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException("Failed to set field value", e);
        }
    }
}
