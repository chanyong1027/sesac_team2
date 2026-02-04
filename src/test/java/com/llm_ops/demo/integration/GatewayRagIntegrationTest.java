package com.llm_ops.demo.integration;

import com.llm_ops.demo.config.TestVectorStoreState;
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
import com.llm_ops.demo.prompt.domain.Prompt;
import com.llm_ops.demo.prompt.domain.PromptRelease;
import com.llm_ops.demo.prompt.domain.PromptVersion;
import com.llm_ops.demo.prompt.repository.PromptReleaseRepository;
import com.llm_ops.demo.prompt.repository.PromptRepository;
import com.llm_ops.demo.prompt.repository.PromptVersionRepository;
import com.llm_ops.demo.workspace.domain.Workspace;
import com.llm_ops.demo.workspace.repository.WorkspaceRepository;
import com.llm_ops.demo.keys.domain.ProviderType;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.document.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

/**
 * Gateway-RAG 통합 시나리오 테스트
 *
 * 이 테스트는 Gateway가 ragEnabled 플래그에 따라 VectorStore(RAG)를 호출하는지 검증합니다.
 * - ragEnabled=false (기본값): RAG 검색 없이 LLM 호출
 * - ragEnabled=true: RAG 검색 후 컨텍스트를 프롬프트에 주입하여 LLM 호출
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "PROVIDER_KEY_ENC_KEY=test-secret",
        "rag.vectorstore.pgvector.enabled=true"
})
@DisplayName("Gateway-RAG 통합 테스트")
@Transactional
class
GatewayRagIntegrationTest {

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
    private TestVectorStoreState testVectorStoreState;

    @Autowired
    private EntityManager entityManager;

    private MockMvc mockMvc;
    private Long organizationId;
    private Long workspaceId;
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
        testVectorStoreState.clear();

        creatorUser = userRepository.save(User.create("test@example.com", "password", "tester"));
        Organization organization = organizationRepository.save(Organization.create("테스트 조직", creatorUser));
        workspace = workspaceRepository.save(Workspace.create(organization, "default", "기본"));
        organizationId = organization.getId();
        workspaceId = workspace.getId();
    }

    @Test
    @DisplayName("ragEnabled=false일 때 VectorStore 데이터가 있어도 RAG 검색하지 않음")
    void gateway_responds_without_rag_when_disabled() throws Exception {
        // given
        Document refundPolicyDoc = new Document(
                "환불 정책은 7일 이내 요청 가능합니다. 환불 신청 후 3-5 영업일 내에 처리됩니다.",
                Map.of("id", "refund-policy-001")
        );
        testVectorStoreState.addDocument(refundPolicyDoc);

        OrganizationApiKeyCreateResponse apiKeyResponse = organizationApiKeyCreateService.create(
                organizationId,
                new OrganizationApiKeyCreateRequest("prod")
        );

        providerCredentialService.register(
                organizationId,
                new ProviderCredentialCreateRequest("openai", "provider-key")
        );

        String promptKey = createReleasedPrompt("refund-policy", "환불 정책을 알려줘");

        // when
        mockMvc.perform(post("/v1/chat/completions")
                        .header("X-API-Key", apiKeyResponse.apiKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {
                                  "workspaceId": %d,
                                  "promptKey": "%s",
                                  "variables": {},
                                  "ragEnabled": false
                                }
                                """, workspaceId, promptKey)))
                // then
                .andExpect(status().isOk());
        assertThat(testVectorStoreState.getLastQuery()).isNull();
    }

    @Test
    @DisplayName("ragEnabled=true일 때 VectorStore에서 RAG 검색을 수행함")
    void gateway_performs_rag_search_when_enabled() throws Exception {
        // given
        Document refundPolicyDoc = new Document(
                "환불 정책은 7일 이내 요청 가능합니다.",
                Map.of("id", "refund-policy-001", "workspace_id", workspaceId)
        );
        testVectorStoreState.addDocument(refundPolicyDoc);

        OrganizationApiKeyCreateResponse apiKeyResponse = organizationApiKeyCreateService.create(
                organizationId,
                new OrganizationApiKeyCreateRequest("prod")
        );

        providerCredentialService.register(
                organizationId,
                new ProviderCredentialCreateRequest("openai", "provider-key")
        );

        String promptKey = createReleasedPrompt("refund-policy", "환불 정책을 알려줘");

        // when
        mockMvc.perform(post("/v1/chat/completions")
                        .header("X-API-Key", apiKeyResponse.apiKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {
                                  "workspaceId": %d,
                                  "promptKey": "%s",
                                  "variables": {},
                                  "ragEnabled": true
                                }
                                """, workspaceId, promptKey)))
                // then
                .andExpect(status().isOk());
        assertThat(testVectorStoreState.getLastQuery()).isNotNull()
                .contains("환불 정책");
    }

    @Test
    @DisplayName("프롬프트 변수 렌더링이 정상 작동함")
    void gateway_renders_prompt_variables() throws Exception {
        // given: API 키 및 Provider 설정
        OrganizationApiKeyCreateResponse apiKeyResponse = organizationApiKeyCreateService.create(
                organizationId,
                new OrganizationApiKeyCreateRequest("prod")
        );

        providerCredentialService.register(
                organizationId,
                new ProviderCredentialCreateRequest("openai", "provider-key")
        );

        String promptKey = createReleasedPrompt("question-template", "질문: {{question}}");

        // when: {{question}} 변수가 있는 프롬프트 요청
        mockMvc.perform(post("/v1/chat/completions")
                        .header("X-API-Key", apiKeyResponse.apiKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {
                                  "workspaceId": %d,
                                  "promptKey": "%s",
                                  "variables": {
                                    "question": "안녕하세요"
                                  }
                                }
                                """, workspaceId, promptKey)))
                // then: 프롬프트 렌더링은 정상 작동
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("ragEnabled 미지정시 기본값 false로 RAG 검색하지 않음")
    void gateway_defaults_to_rag_disabled() throws Exception {
        // given
        testVectorStoreState.addDocument(new Document(
                "상품 A는 가격이 10,000원입니다.",
                Map.of("id", "product-a-001")
        ));

        OrganizationApiKeyCreateResponse apiKeyResponse = organizationApiKeyCreateService.create(
                organizationId,
                new OrganizationApiKeyCreateRequest("prod")
        );

        providerCredentialService.register(
                organizationId,
                new ProviderCredentialCreateRequest("openai", "provider-key")
        );

        String promptKey = createReleasedPrompt("product-price", "상품 A의 가격은 얼마인가요?");

        // when: ragEnabled 필드 없이 요청
        mockMvc.perform(post("/v1/chat/completions")
                        .header("X-API-Key", apiKeyResponse.apiKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("""
                                {
                                  "workspaceId": %d,
                                  "promptKey": "%s",
                                  "variables": {}
                                }
                                """, workspaceId, promptKey)))
                // then
                .andExpect(status().isOk());
        assertThat(testVectorStoreState.getLastQuery()).isNull();
    }

    private String createReleasedPrompt(String promptKey, String userTemplate) {
        Prompt prompt = promptRepository.save(Prompt.create(workspace, promptKey, "test prompt"));
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
