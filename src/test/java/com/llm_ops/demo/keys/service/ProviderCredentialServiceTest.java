package com.llm_ops.demo.keys.service;

import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.keys.dto.ProviderCredentialCreateRequest;
import com.llm_ops.demo.keys.repository.ProviderCredentialRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = "PROVIDER_KEY_ENC_KEY=test-secret")
class ProviderCredentialServiceTest {

    @Autowired
    private ProviderCredentialService providerCredentialService;

    @Autowired
    private ProviderCredentialRepository providerCredentialRepository;

    @BeforeEach
    void setUp() {
        providerCredentialRepository.deleteAll();
    }

    private void activateCredential(Long organizationId, ProviderType providerType) {
        var credential = providerCredentialRepository
                .findByOrganizationIdAndProvider(organizationId, providerType).orElseThrow();
        credential.markActive();
        providerCredentialRepository.save(credential);
    }

    @Test
    @DisplayName("조직+프로바이더로 저장된 키를 복호화하여 조회한다")
    void 저장된_키를_복호화하여_조회한다() {
        // given
        Long organizationId = 1L;
        String apiKey = "test-key";

        providerCredentialService.register(
                organizationId,
                new ProviderCredentialCreateRequest("openai", apiKey));
        activateCredential(organizationId, ProviderType.OPENAI);

        // when
        String decryptedApiKey = providerCredentialService.getDecryptedApiKey(
                organizationId,
                ProviderType.OPENAI);

        // then
        assertThat(decryptedApiKey).isEqualTo(apiKey);
    }

    @Test
    @DisplayName("등록된 키가 없으면 NOT_FOUND 예외가 발생한다")
    void 등록된_키가_없으면_예외가_발생한다() {
        // given
        Long organizationId = 1L;

        // when & then
        assertThatThrownBy(() -> providerCredentialService.getDecryptedApiKey(
                organizationId,
                ProviderType.OPENAI))
                .isInstanceOf(BusinessException.class)
                .satisfies(exception -> {
                    BusinessException businessException = (BusinessException) exception;
                    assertThat(businessException.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND);
                });
    }
}
