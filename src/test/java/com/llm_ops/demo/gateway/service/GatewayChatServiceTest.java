package com.llm_ops.demo.gateway.service;

import com.llm_ops.demo.config.TestSecurityConfig;
import com.llm_ops.demo.gateway.dto.GatewayChatRequest;
import com.llm_ops.demo.config.TestChatModelState;
import com.llm_ops.demo.gateway.log.domain.RequestLog;
import com.llm_ops.demo.gateway.log.domain.RequestLogStatus;
import com.llm_ops.demo.gateway.log.repository.RequestLogRepository;
import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateRequest;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateResponse;
import com.llm_ops.demo.keys.dto.ProviderCredentialCreateRequest;
import com.llm_ops.demo.keys.repository.OrganizationApiKeyRepository;
import com.llm_ops.demo.keys.domain.OrganizationApiKey;
import com.llm_ops.demo.keys.repository.ProviderCredentialRepository;
import com.llm_ops.demo.keys.service.OrganizationApiKeyCreateService;
import com.llm_ops.demo.keys.service.ProviderCredentialService;
import com.llm_ops.demo.keys.domain.ProviderType;
import com.llm_ops.demo.organization.domain.Organization;
import com.llm_ops.demo.organization.repository.OrganizationRepository;
import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptRelease;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import com.llm_ops.demo.prompt.repository.PromptReleaseRepository;
import com.llm_ops.demo.prompt.repository.PromptRepository;
import com.llm_ops.demo.prompt.repository.PromptVersionRepository;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.repository.WorkspaceRepository;
import com.llm_ops.demo.global.error.GatewayException;
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
import org.springframework.beans.factory.annotation.Autowired;
import jakarta.persistence.EntityManager;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = "PROVIDER_KEY_ENC_KEY=test-secret")
@Import(TestSecurityConfig.class)
@Transactional
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

        @Autowired
        private UserRepository userRepository;

        @Autowired
        private OrganizationRepository organizationRepository;

        @Autowired
        private WorkspaceRepository workspaceRepository;

        @Autowired
        private PromptRepository promptRepository;

        @Autowired
        private PromptVersionRepository promptVersionRepository;

        @Autowired
        private PromptReleaseRepository promptReleaseRepository;

        @Autowired
        private EntityManager entityManager;

        private Long organizationId;
        private Long workspaceId;
        private String promptKey;
        private User creatorUser;
        private Workspace workspace;

        @BeforeEach
        void setUp() {
                organizationApiKeyRepository.deleteAll();
                providerCredentialRepository.deleteAll();
                requestLogRepository.deleteAll();
                promptReleaseRepository.deleteAll();
                promptVersionRepository.deleteAll();
                promptRepository.deleteAll();
                workspaceRepository.deleteAll();
                organizationRepository.deleteAll();
                userRepository.deleteAll();

                creatorUser = userRepository.save(User.create("test@example.com", "password", "tester"));
                Organization organization = organizationRepository.save(Organization.create("테스트 조직", creatorUser));
                workspace = workspaceRepository.save(Workspace.create(organization, "default", "기본"));
                organizationId = organization.getId();
                workspaceId = workspace.getId();
                promptKey = createReleasedPrompt("cs-bot", "hello {{name}}");
        }

        @Test
        @DisplayName("변수 치환된 프롬프트가 모델 호출에 사용된다")
        void 변수_치환된_프롬프트로_응답을_받는다() {
                // given
                OrganizationApiKeyCreateResponse response = organizationApiKeyCreateService.create(
                                organizationId,
                                new OrganizationApiKeyCreateRequest("prod"));

                OrganizationApiKey apiKeyEntity = organizationApiKeyRepository.findAll().get(0);

                providerCredentialService.register(
                                organizationId,
                                new ProviderCredentialCreateRequest("openai", "provider-key"));
                activateCredential(organizationId, ProviderType.OPENAI);

                GatewayChatRequest request = new GatewayChatRequest(
                                workspaceId,
                                promptKey,
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
                assertThat(requestLog.getRequestPayload()).isNotBlank();
                assertThat(requestLog.getRequestPayload()).contains("\"workspaceId\":" + workspaceId);
                assertThat(requestLog.getRequestPayload()).contains("\"promptKey\":\"" + promptKey + "\"");
                assertThat(requestLog.getRequestPayload()).contains("\"variablesCount\":1");
                assertThat(requestLog.getRequestPayload()).doesNotContain("lumina");

                assertThat(requestLog.getApiKeyId()).isEqualTo(apiKeyEntity.getId());
                assertThat(requestLog.getApiKeyPrefix()).isEqualTo(apiKeyEntity.getKeyPrefix());
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
                                organizationId,
                                new OrganizationApiKeyCreateRequest("prod"));

                OrganizationApiKey apiKeyEntity = organizationApiKeyRepository.findAll().get(0);
                GatewayChatRequest request = new GatewayChatRequest(
                                9999L,
                                promptKey,
                                Map.of(),
                                true
                );

                // when
                Throwable thrown = org.assertj.core.api.Assertions.catchThrowable(
                        () -> gatewayChatService.chat(response.apiKey(), request)
                );

                // then
                assertThat(thrown).isInstanceOf(GatewayException.class);
                assertThat(((GatewayException) thrown).getCode()).isEqualTo("GW-REQ-FORBIDDEN");

                List<RequestLog> logs = requestLogRepository.findAll();
                assertThat(logs).hasSize(1);
                RequestLog requestLog = logs.get(0);
                assertThat(requestLog.getStatus()).isEqualTo(RequestLogStatus.FAIL);
                assertThat(requestLog.getHttpStatus()).isEqualTo(403);
                assertThat(requestLog.getErrorCode()).isEqualTo("GW-REQ-FORBIDDEN");
                assertThat(requestLog.getFailReason()).isEqualTo("FORBIDDEN");
                assertThat(requestLog.getResponsePayload()).isNotBlank();
                assertThat(requestLog.getResponsePayload()).contains("\"errorCode\":\"GW-REQ-FORBIDDEN\"");
                assertThat(requestLog.getResponsePayload()).contains("\"type\":\"GATEWAY_FAILURE\"");
                assertThat(requestLog.getResponsePayload()).doesNotContain("워크스페이스 접근 권한이 없습니다.");
                assertThat(requestLog.getFinishedAt()).isNotNull();
                assertThat(requestLog.getApiKeyId()).isEqualTo(apiKeyEntity.getId());
                assertThat(requestLog.getApiKeyPrefix()).isEqualTo(apiKeyEntity.getKeyPrefix());
        }

        @Test
        @DisplayName("question 변수가 있으면 requestPayload에 사용자 질문 원문이 저장된다")
        void question_변수가_있으면_requestPayload에_질문이_저장된다() {
                // given
                OrganizationApiKeyCreateResponse response = organizationApiKeyCreateService.create(
                                organizationId,
                                new OrganizationApiKeyCreateRequest("prod"));

                providerCredentialService.register(
                                organizationId,
                                new ProviderCredentialCreateRequest("openai", "provider-key"));
                activateCredential(organizationId, ProviderType.OPENAI);

                String questionPromptKey = createReleasedPrompt("question-bot", "{{question}}");
                String question = "스타벅스가 뭐야?";
                GatewayChatRequest request = new GatewayChatRequest(
                                workspaceId,
                                questionPromptKey,
                                Map.of("question", question),
                                false);

                // when
                var chatResponse = gatewayChatService.chat(response.apiKey(), request);

                // then
                RequestLog requestLog = requestLogRepository.findByTraceId(chatResponse.traceId()).orElseThrow();
                assertThat(requestLog.getRequestPayload()).contains("\"question\":\"" + question + "\"");
        }

        private void activateCredential(Long orgId, ProviderType providerType) {
                var credential = providerCredentialRepository
                        .findByOrganizationIdAndProvider(orgId, providerType).orElseThrow();
                credential.markActive();
                providerCredentialRepository.save(credential);
        }

        private String createReleasedPrompt(String key, String userTemplate) {
                Prompt prompt = promptRepository.save(Prompt.create(workspace, key, "test prompt"));
                PromptVersion version = promptVersionRepository.save(
                        PromptVersion.create(
                                prompt,
                                1,
                                "v1",
                                ProviderType.OPENAI,
                                "gpt-4o-mini",
                                null,
                                null,
                                null,
                                userTemplate,
                                false,
                                null,
                                null,
                                creatorUser
                        )
                );
                PromptRelease release = PromptRelease.create(prompt, version);
                entityManager.persist(release);
                entityManager.flush();
                return prompt.getPromptKey();
        }
}
