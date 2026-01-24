package com.llm_ops.demo.gateway.service;

import com.llm_ops.demo.gateway.dto.GatewayChatRequest;
import com.llm_ops.demo.config.TestChatModelState;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateRequest;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateResponse;
import com.llm_ops.demo.keys.dto.ProviderCredentialCreateRequest;
import com.llm_ops.demo.keys.repository.OrganizationApiKeyRepository;
import com.llm_ops.demo.keys.repository.ProviderCredentialRepository;
import com.llm_ops.demo.keys.service.OrganizationApiKeyCreateService;
import com.llm_ops.demo.keys.service.ProviderCredentialService;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import org.springframework.beans.factory.annotation.Autowired;

@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = "PROVIDER_KEY_ENC_KEY=test-secret")
class GatewayChatServiceTest {

    @Autowired
    private GatewayChatService gatewayChatService;

    @Autowired
    private ProviderCredentialService providerCredentialService;

    @Autowired
    private OrganizationApiKeyCreateService organizationApiKeyCreateService;

    @Autowired
    private OrganizationApiKeyRepository organizationApiKeyRepository;

    @Autowired
    private ProviderCredentialRepository providerCredentialRepository;

    @Autowired
    private TestChatModelState testChatModelState;

    @BeforeEach
    void setUp() {
        organizationApiKeyRepository.deleteAll();
        providerCredentialRepository.deleteAll();
    }

    @Test
    @DisplayName("변수 치환된 프롬프트가 모델 호출에 사용된다")
    void 변수_치환된_프롬프트로_응답을_받는다() {
        // given
        OrganizationApiKeyCreateResponse response = organizationApiKeyCreateService.create(
                1L,
                new OrganizationApiKeyCreateRequest("prod")
        );

        providerCredentialService.register(
                1L,
                new ProviderCredentialCreateRequest("openai", "provider-key")
        );

        GatewayChatRequest request = new GatewayChatRequest(
                1L,
                "hello {{name}}",
                Map.of("name", "lumina")
        );

        // when
        var chatResponse = gatewayChatService.chat(response.apiKey(), request);

        // then
        assertThat(chatResponse.answer()).isEqualTo("hello lumina");
        assertThat(chatResponse.isFailover()).isFalse();
        assertThat(chatResponse.usage()).isNotNull();
        assertThat(chatResponse.usage().totalTokens()).isEqualTo(0L);
        assertThat(chatResponse.traceId()).isNotBlank();

        var lastPrompt = testChatModelState.getLastPrompt();
        assertThat(lastPrompt).isNotNull();
        assertThat(lastPrompt.getOptions()).isInstanceOf(OpenAiChatOptions.class);
        OpenAiChatOptions options = (OpenAiChatOptions) lastPrompt.getOptions();
        assertThat(options.getHttpHeaders())
                .containsEntry("Authorization", "Bearer provider-key");
    }
}
