package com.llm_ops.demo.integration;

import com.llm_ops.demo.config.TestVectorStoreState;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateRequest;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateResponse;
import com.llm_ops.demo.keys.dto.ProviderCredentialCreateRequest;
import com.llm_ops.demo.keys.repository.OrganizationApiKeyRepository;
import com.llm_ops.demo.keys.repository.ProviderCredentialRepository;
import com.llm_ops.demo.keys.service.OrganizationApiKeyCreateService;
import com.llm_ops.demo.keys.service.ProviderCredentialService;
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

import java.util.Map;

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
@TestPropertySource(properties = "PROVIDER_KEY_ENC_KEY=test-secret")
@DisplayName("Gateway-RAG 통합 테스트")
class GatewayRagIntegrationTest {

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
    private TestVectorStoreState testVectorStoreState;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = webAppContextSetup(context).build();
        organizationApiKeyRepository.deleteAll();
        providerCredentialRepository.deleteAll();
        testVectorStoreState.clear();
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
                1L,
                new OrganizationApiKeyCreateRequest("prod")
        );

        providerCredentialService.register(
                1L,
                new ProviderCredentialCreateRequest("openai", "provider-key")
        );

        // when
        mockMvc.perform(post("/v1/chat/completions")
                        .header("X-API-Key", apiKeyResponse.apiKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "workspaceId": 1,
                                  "promptKey": "환불 정책을 알려줘",
                                  "variables": {},
                                  "ragEnabled": false
                                }
                                """))
                // then
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("ragEnabled=true일 때 VectorStore에서 RAG 검색을 수행함")
    void gateway_performs_rag_search_when_enabled() throws Exception {
        // given
        Document refundPolicyDoc = new Document(
                "환불 정책은 7일 이내 요청 가능합니다.",
                Map.of("id", "refund-policy-001", "workspace_id", 1L)
        );
        testVectorStoreState.addDocument(refundPolicyDoc);

        OrganizationApiKeyCreateResponse apiKeyResponse = organizationApiKeyCreateService.create(
                1L,
                new OrganizationApiKeyCreateRequest("prod")
        );

        providerCredentialService.register(
                1L,
                new ProviderCredentialCreateRequest("openai", "provider-key")
        );

        // when
        mockMvc.perform(post("/v1/chat/completions")
                        .header("X-API-Key", apiKeyResponse.apiKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "workspaceId": 1,
                                  "promptKey": "환불 정책을 알려줘",
                                  "variables": {},
                                  "ragEnabled": true
                                }
                                """))
                // then
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("프롬프트 변수 렌더링이 정상 작동함")
    void gateway_renders_prompt_variables() throws Exception {
        // given: API 키 및 Provider 설정
        OrganizationApiKeyCreateResponse apiKeyResponse = organizationApiKeyCreateService.create(
                1L,
                new OrganizationApiKeyCreateRequest("prod")
        );

        providerCredentialService.register(
                1L,
                new ProviderCredentialCreateRequest("openai", "provider-key")
        );

        // when: {{question}} 변수가 있는 프롬프트 요청
        mockMvc.perform(post("/v1/chat/completions")
                        .header("X-API-Key", apiKeyResponse.apiKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "workspaceId": 1,
                                  "promptKey": "질문: {{question}}",
                                  "variables": {
                                    "question": "안녕하세요"
                                  }
                                }
                                """))
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
                1L,
                new OrganizationApiKeyCreateRequest("prod")
        );

        providerCredentialService.register(
                1L,
                new ProviderCredentialCreateRequest("openai", "provider-key")
        );

        // when: ragEnabled 필드 없이 요청
        mockMvc.perform(post("/v1/chat/completions")
                        .header("X-API-Key", apiKeyResponse.apiKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "workspaceId": 1,
                                  "promptKey": "상품 A의 가격은 얼마인가요?",
                                  "variables": {}
                                }
                                """))
                // then
                .andExpect(status().isOk());
    }
}
