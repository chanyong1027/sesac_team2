package com.llm_ops.demo.e2e;

import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateRequest;
import com.llm_ops.demo.keys.dto.OrganizationApiKeyCreateResponse;
import com.llm_ops.demo.keys.dto.ProviderCredentialCreateRequest;
import com.llm_ops.demo.keys.repository.OrganizationApiKeyRepository;
import com.llm_ops.demo.keys.repository.ProviderCredentialRepository;
import com.llm_ops.demo.keys.service.OrganizationApiKeyCreateService;
import com.llm_ops.demo.keys.service.ProviderCredentialService;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestPropertySource(properties = "PROVIDER_KEY_ENC_KEY=test-secret")
@DisplayName("E2E 통합 테스트 - ChatCompletion")
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

    private MockMvc mockMvc;
    private OrganizationApiKeyCreateResponse apiKeyResponse;

    @BeforeEach
    void setUp() {
        mockMvc = webAppContextSetup(context).build();
        organizationApiKeyRepository.deleteAll();
        providerCredentialRepository.deleteAll();

        apiKeyResponse = organizationApiKeyCreateService.create(
                1L,
                new OrganizationApiKeyCreateRequest("prod")
        );

        providerCredentialService.register(
                1L,
                new ProviderCredentialCreateRequest("openai", "provider-key")
        );
    }

    @AfterEach
    void tearDown() {
        organizationApiKeyRepository.deleteAll();
        providerCredentialRepository.deleteAll();
    }

    @Test
    @DisplayName("정상_채팅_요청_성공")
    void 정상_채팅_요청_성공() throws Exception {
        mockMvc.perform(post("/v1/chat/completions")
                        .header("X-API-Key", apiKeyResponse.apiKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "workspaceId": 1,
                                  "promptKey": "hello {{name}}",
                                  "variables": {
                                    "name": "lumina"
                                  }
                                }
                                """))
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
                        .content("""
                                {
                                  "workspaceId": 1,
                                  "promptKey": "hello {{name}}",
                                  "variables": {
                                    "name": "lumina"
                                  }
                                }
                                """))
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
                        .content("""
                                {
                                  "workspaceId": 1,
                                  "promptKey": "hello"
                                }
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("유효성_실패_400")
    void 유효성_실패_400() throws Exception {
        mockMvc.perform(post("/v1/chat/completions")
                        .header("X-API-Key", apiKeyResponse.apiKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "promptKey": "hello"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("C400"));
    }

    @Test
    @DisplayName("프로바이더_라우팅_테스트")
    void 프로바이더_라우팅_테스트() throws Exception {
        mockMvc.perform(post("/v1/chat/completions")
                        .header("X-API-Key", apiKeyResponse.apiKey())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "workspaceId": 1,
                                  "promptKey": "hello {{name}}",
                                  "variables": {
                                    "name": "test"
                                  }
                                }
                                """))
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
                        .content("""
                                {
                                  "workspaceId": 1,
                                  "promptKey": "hello {{name}}",
                                  "variables": {
                                    "name": null
                                  }
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("C400"));
    }
}
