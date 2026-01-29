package com.llm_ops.demo.e2e;

import com.llm_ops.demo.gateway.dto.GatewayChatRequest;
import com.llm_ops.demo.gateway.service.GatewayChatService;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateRequest;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateResponse;
import com.llm_ops.demo.keys.dto.ProviderCredentialCreateRequest;
import com.llm_ops.demo.keys.repository.OrganizationApiKeyRepository;
import com.llm_ops.demo.keys.repository.ProviderCredentialRepository;
import com.llm_ops.demo.keys.service.OrganizationApiKeyCreateService;
import com.llm_ops.demo.keys.service.ProviderCredentialService;
import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.organization.domain.Organization;
import com.llm_ops.demo.organization.repository.OrganizationRepository;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.repository.WorkspaceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 실제 OpenAI API를 호출하는 E2E 테스트입니다.
 * 환경변수가 설정되어 있을 때만 실행됩니다.
 *
 * 실행 조건:
 * - OPENAI_API_KEY: OpenAI API 키
 * - GATEWAY_REAL_API_TEST: "true"로 설정
 *
 * 실행 방법:
 * OPENAI_API_KEY=sk-... GATEWAY_REAL_API_TEST=true ./gradlew test --tests "ChatCompletionRealApiTest"
 */
@SpringBootTest
@ActiveProfiles("local")
@TestPropertySource(properties = "PROVIDER_KEY_ENC_KEY=test-secret")
@EnabledIfEnvironmentVariable(named = "OPENAI_API_KEY", matches = ".+")
@EnabledIfEnvironmentVariable(named = "GATEWAY_REAL_API_TEST", matches = "true")
class ChatCompletionRealApiTest {

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
    private UserRepository userRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private WorkspaceRepository workspaceRepository;

    private Long organizationId;
    private Long workspaceId;

    @BeforeEach
    void setUp() {
        organizationApiKeyRepository.deleteAll();
        providerCredentialRepository.deleteAll();
        workspaceRepository.deleteAll();
        organizationRepository.deleteAll();
        userRepository.deleteAll();

        User creator = userRepository.save(User.create("realapi@example.com", "password", "tester"));
        Organization organization = organizationRepository.save(Organization.create("테스트 조직", creator));
        Workspace workspace = workspaceRepository.save(Workspace.create(organization, "default", "기본"));
        organizationId = organization.getId();
        workspaceId = workspace.getId();
    }

    @Test
    @DisplayName("실제 OpenAI API를 호출하여 응답을 받는다")
    void 실제_OpenAI_API_호출_테스트() {
        // given
        OrganizationApiKeyCreateResponse apiKeyResponse = organizationApiKeyCreateService.create(
                organizationId,
                new OrganizationApiKeyCreateRequest("prod")
        );

        String openaiApiKey = System.getenv("OPENAI_API_KEY");
        providerCredentialService.register(
                organizationId,
                new ProviderCredentialCreateRequest("openai", openaiApiKey)
        );

        GatewayChatRequest request = new GatewayChatRequest(
                workspaceId,
                "안녕하세요. 당신은 누구입니까?",
                Map.of(),
                false
        );

        // when
        var chatResponse = gatewayChatService.chat(apiKeyResponse.apiKey(), request);

        // then
        assertThat(chatResponse.answer()).isNotNull().isNotBlank();
        assertThat(chatResponse.usedModel()).isNotNull().isNotBlank();
        assertThat(chatResponse.traceId()).isNotNull().isNotBlank();
        assertThat(chatResponse.isFailover()).isFalse();
    }
}
