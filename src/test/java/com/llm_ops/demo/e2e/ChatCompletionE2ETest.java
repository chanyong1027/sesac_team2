package com.llm_ops.demo.e2e;

import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateRequest;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateResponse;
import com.llm_ops.demo.keys.dto.ProviderCredentialCreateRequest;
import com.llm_ops.demo.keys.repository.OrganizationApiKeyRepository;
import com.llm_ops.demo.keys.repository.ProviderCredentialRepository;
import com.llm_ops.demo.keys.service.OrganizationApiKeyCreateService;
import com.llm_ops.demo.keys.service.ProviderCredentialService;
import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.repository.UserRepository;
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
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestPropertySource(properties = "PROVIDER_KEY_ENC_KEY=test-secret")
@DisplayName("E2E 통합 테스트 - ChatCompletion")
@Transactional
class ChatCompletionE2ETest {

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private OrganizationApiKeyCreateService organizationApiKeyCreateService;

    @Autowired
    private OrganizationApiKeyRepository organizationApiKeyRepository;

    @Autowired
    private ProviderCredentialService providerCredentialService;

    @Autowired
    private ProviderCredentialRepository providerCredentialRepository;

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

    private MockMvc mockMvc;
    private OrganizationApiKeyCreateResponse apiKeyResponse;
    private Long organizationId;
    private Long workspaceId;
    private String promptKey;
    private User creatorUser;
    private Workspace workspace;

    @BeforeEach
    void setUp() {
        mockMvc = webAppContextSetup(context).build();
        organizationApiKeyRepository.deleteAll();
        providerCredentialRepository.deleteAll();
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

        apiKeyResponse = organizationApiKeyCreateService.create(
                organizationId,
                new OrganizationApiKeyCreateRequest("prod")
        );

        providerCredentialService.register(
                organizationId,
                new ProviderCredentialCreateRequest("openai", "provider-key")
        );
        activateCredential(organizationId, ProviderType.OPENAI);
    }

    @AfterEach
    void tearDown() {
        organizationApiKeyRepository.deleteAll();
        providerCredentialRepository.deleteAll();
    }

    private void activateCredential(Long organizationId, ProviderType providerType) {
        var credential = providerCredentialRepository
                .findByOrganizationIdAndProvider(organizationId, providerType).orElseThrow();
        credential.markActive();
        providerCredentialRepository.save(credential);
    }

    @Test
    @DisplayName("정상_채팅_요청_성공")
    void 정상_채팅_요청_성공() throws Exception {
        mockMvc.perform(post("/v1/chat/completions")
                        .header("X-API-Key", apiKeyResponse.apiKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {
                                  "workspaceId": %d,
                                  "promptKey": "%s",
                                  "variables": {
                                    "name": "lumina"
                                  }
                                }
                                """, workspaceId, promptKey)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.answer").value("hello lumina"))
                .andExpect(jsonPath("$.traceId").isString())
                .andExpect(jsonPath("$.isFailover").value(false));
    }

    @Test
    @DisplayName("변수_치환_정상_동작")
    void 변수_치환_정상_동작() throws Exception {
        mockMvc.perform(post("/v1/chat/completions")
                        .header("X-API-Key", apiKeyResponse.apiKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {
                                  "workspaceId": %d,
                                  "promptKey": "%s",
                                  "variables": {
                                    "name": "lumina"
                                  }
                                }
                                """, workspaceId, promptKey)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.answer").value("hello lumina"))
                .andExpect(jsonPath("$.traceId").isString())
                .andExpect(jsonPath("$.isFailover").value(false));
    }

    @Test
    @DisplayName("인증_실패_401")
    void 인증_실패_401() throws Exception {
        mockMvc.perform(post("/v1/chat/completions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {
                                  "workspaceId": %d,
                                  "promptKey": "%s"
                                }
                                """, workspaceId, promptKey)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("유효성_실패_400")
    void 유효성_실패_400() throws Exception {
        mockMvc.perform(post("/v1/chat/completions")
                        .header("X-API-Key", apiKeyResponse.apiKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {
                                  "promptKey": "%s"
                                }
                                """, promptKey)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("C400"));
    }

    @Test
    @DisplayName("프로바이더_라우팅_테스트")
    void 프로바이더_라우팅_테스트() throws Exception {
        mockMvc.perform(post("/v1/chat/completions")
                        .header("X-API-Key", apiKeyResponse.apiKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {
                                  "workspaceId": %d,
                                  "promptKey": "%s",
                                  "variables": {
                                    "name": "test"
                                  }
                                }
                                """, workspaceId, promptKey)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.answer").value("hello test"))
                .andExpect(jsonPath("$.traceId").isString())
                .andExpect(jsonPath("$.isFailover").value(false));
    }

    @Test
    @DisplayName("변수_값이_null이면_400_예외가_발생한다")
    void 변수_값이_null이면_400_예외가_발생한다() throws Exception {
        mockMvc.perform(post("/v1/chat/completions")
                        .header("X-API-Key", apiKeyResponse.apiKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {
                                  "workspaceId": %d,
                                  "promptKey": "%s",
                                  "variables": {
                                    "name": null
                                  }
                                }
                                """, workspaceId, promptKey)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("C400"));
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
