package com.llm_ops.demo.keys.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateRequest;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateResponse;
import com.llm_ops.demo.keys.repository.OrganizationApiKeyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
class OrganizationApiKeyAuthServiceTest {

    @Autowired
    private OrganizationApiKeyAuthService organizationApiKeyAuthService;

    @Autowired
    private OrganizationApiKeyCreateService organizationApiKeyCreateService;

    @Autowired
    private OrganizationApiKeyRepository organizationApiKeyRepository;

    @BeforeEach
    void setUp() {
        organizationApiKeyRepository.deleteAll();
    }

    @Test
    @DisplayName("유효한 API Key로 조직 ID를 조회한다")
    void 유효한_api_key면_조직_id를_반환한다() {
        // given
        Long organizationId = 1L;
        OrganizationApiKeyCreateResponse response = organizationApiKeyCreateService.create(
                organizationId,
                new OrganizationApiKeyCreateRequest("prod"));

        // when
        Long resolvedOrganizationId = organizationApiKeyAuthService.resolveOrganizationId(response.apiKey());

        // then
        assertThat(resolvedOrganizationId).isEqualTo(organizationId);
    }

    @Test
    @DisplayName("유효하지 않은 API Key면 인증 예외가 발생한다")
    void 유효하지_않은_api_key면_예외가_발생한다() {
        // given
        // when & then
        assertThatThrownBy(() -> organizationApiKeyAuthService.resolveOrganizationId("invalid-key"))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> {
                    BusinessException businessException = (BusinessException) exception;
                    assertThat(businessException.getErrorCode()).isEqualTo(ErrorCode.UNAUTHENTICATED);
                });
    }
}
