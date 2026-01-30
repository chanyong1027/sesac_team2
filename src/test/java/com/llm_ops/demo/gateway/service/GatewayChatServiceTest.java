package com.llm_ops.demo.gateway.service;

import com.llm_ops.demo.config.TestSecurityConfig;
import com.llm_ops.demo.gateway.dto.GatewayChatRequest;
import com.llm_ops.demo.config.TestChatModelState;
import com.llm_ops.demo.gateway.log.domain.RequestLog;
import com.llm_ops.demo.gateway.log.domain.RequestLogStatus;
import com.llm_ops.demo.gateway.log.repository.RequestLogRepository;
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
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.util.Map;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.springframework.beans.factory.annotation.Autowired;

@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = "PROVIDER_KEY_ENC_KEY=test-secret")
@Import(TestSecurityConfig.class)
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
        private RequestLogRepository requestLogRepository;

        @Autowired
        private TestChatModelState testChatModelState;

        @BeforeEach
        void setUp() {
                organizationApiKeyRepository.deleteAll();
                providerCredentialRepository.deleteAll();
                requestLogRepository.deleteAll();
        }

        @Test
        @DisplayName("변수 치환된 프롬프트가 모델 호출에 사용된다")
        void 변수_치환된_프롬프트로_응답을_받는다() {
                // given
                OrganizationApiKeyCreateResponse response = organizationApiKeyCreateService.create(
                                1L,
                                new OrganizationApiKeyCreateRequest("prod"));

                providerCredentialService.register(
                                1L,
                                new ProviderCredentialCreateRequest("openai", "provider-key"));

                GatewayChatRequest request = new GatewayChatRequest(
                                1L,
                                "hello {{name}}",
                                Map.of("name", "lumina"),
                                false);

                // when
                var chatResponse = gatewayChatService.chat(response.apiKey(), request);

                // then
                assertThat(chatResponse.answer()).isEqualTo("hello lumina");
                assertThat(chatResponse.isFailover()).isFalse();
                assertThat(chatResponse.usage()).isNotNull();
                assertThat(chatResponse.usage().totalTokens()).isEqualTo(0L);
                assertThat(chatResponse.traceId()).isNotBlank();

                RequestLog requestLog = requestLogRepository.findByTraceId(chatResponse.traceId()).orElseThrow();
                assertThat(requestLog.getStatus()).isEqualTo(RequestLogStatus.SUCCESS);
                assertThat(requestLog.getHttpStatus()).isEqualTo(200);
                assertThat(requestLog.getLatencyMs()).isNotNull();
                assertThat(requestLog.getFinishedAt()).isNotNull();

                var lastPrompt = testChatModelState.getLastPrompt();
                assertThat(lastPrompt).isNotNull();
                assertThat(lastPrompt.getOptions()).isInstanceOf(OpenAiChatOptions.class);
                OpenAiChatOptions options = (OpenAiChatOptions) lastPrompt.getOptions();
                assertThat(options.getHttpHeaders())
                                .containsEntry("Authorization", "Bearer provider-key");
        }

        @Test
        @DisplayName("RAG 권한 검증 실패 시에도 FAIL 로그가 1건 남는다")
        void RAG_권한_검증_실패시_FAIL_로그가_남는다() {
                // given
                OrganizationApiKeyCreateResponse response = organizationApiKeyCreateService.create(
                                1L,
                                new OrganizationApiKeyCreateRequest("prod"));

                GatewayChatRequest request = new GatewayChatRequest(
                                9999L,
                                "hello",
                                Map.of(),
                                true
                );

                // when
                assertThatThrownBy(() -> gatewayChatService.chat(response.apiKey(), request))
                                .isInstanceOf(com.llm_ops.demo.global.error.BusinessException.class);

                // then
                List<RequestLog> logs = requestLogRepository.findAll();
                assertThat(logs).hasSize(1);
                RequestLog requestLog = logs.get(0);
                assertThat(requestLog.getStatus()).isEqualTo(RequestLogStatus.FAIL);
                assertThat(requestLog.getHttpStatus()).isEqualTo(403);
                assertThat(requestLog.getErrorCode()).isEqualTo("FORBIDDEN");
                assertThat(requestLog.getFailReason()).isEqualTo("BUSINESS_EXCEPTION");
                assertThat(requestLog.getFinishedAt()).isNotNull();
        }
}
