package com.llm_ops.demo.keys.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.domain.OrganizationApiKey;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateRequest;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateResponse;
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
class OrganizationApiKeyCreateServiceTest {

    @Autowired
    private OrganizationApiKeyCreateService organizationApiKeyCreateService;

    @Autowired
    private OrganizationApiKeyRepository organizationApiKeyRepository;

    @BeforeEach
    void setUp() {
        organizationApiKeyRepository.deleteAll();
    }

    @Test
    @DisplayName("조직 외부 호출용 API 키를 생성하고, 원문은 응답으로 1회만 반환한다")
    void 조직_외부_호출용_api_키를_생성한다() throws Exception {
        // given
        Long organizationId = 1L;
        OrganizationApiKeyCreateRequest request = new OrganizationApiKeyCreateRequest("prod");

        // when
        OrganizationApiKeyCreateResponse response = organizationApiKeyCreateService.create(organizationId, request);

        // then
        assertThat(response.apiKey()).startsWith("lum_");
        assertThat(organizationApiKeyRepository.count()).isEqualTo(1);

        OrganizationApiKey saved = organizationApiKeyRepository.findAll().get(0);
        assertThat(saved.getOrganizationId()).isEqualTo(organizationId);
        assertThat(saved.getName()).isEqualTo("prod");
        assertThat(saved.getKeyPrefix()).isEqualTo(response.apiKey().substring(0, 12));

        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(response.apiKey().getBytes(StandardCharsets.UTF_8));
        StringBuilder hex = new StringBuilder(hash.length * 2);
        for (byte b : hash) {
            hex.append(String.format("%02x", b));
        }
        assertThat(saved.getKeyHash()).isEqualTo(hex.toString());
        assertThat(saved.getKeyHash()).isNotEqualTo(response.apiKey());
    }

    @Test
    @DisplayName("조직 내 동일한 name으로 생성하면 409 예외가 발생한다")
    void 동일한_name이면_예외가_발생한다() {
        // given
        Long organizationId = 1L;
        OrganizationApiKeyCreateRequest request = new OrganizationApiKeyCreateRequest("prod");

        organizationApiKeyCreateService.create(organizationId, request);

        // when & then
        assertThatThrownBy(() -> organizationApiKeyCreateService.create(organizationId, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> {
                    BusinessException businessException = (BusinessException) exception;
                    assertThat(businessException.getErrorCode()).isEqualTo(ErrorCode.CONFLICT);
                });
    }
}

