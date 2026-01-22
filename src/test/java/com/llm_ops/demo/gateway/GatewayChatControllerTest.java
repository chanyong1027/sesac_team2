package com.llm_ops.demo.gateway;

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
class GatewayChatControllerTest {

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

    @BeforeEach
    void setUp() {
        mockMvc = webAppContextSetup(context).build();
        organizationApiKeyRepository.deleteAll();
        providerCredentialRepository.deleteAll();
    }

    @Test
    @DisplayName("게이트웨이 호출 시 응답이 정상적으로 반환된다")
    void 게이트웨이_호출에_성공한다() throws Exception {
        // given
        OrganizationApiKeyCreateResponse apiKeyResponse = organizationApiKeyCreateService.create(
                1L,
                new OrganizationApiKeyCreateRequest("prod")
        );

        providerCredentialService.register(
                1L,
                new ProviderCredentialCreateRequest("openai", "provider-key")
        );

        // when & then
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
    @DisplayName("API Key가 없으면 인증 예외가 발생한다")
    void api_key가_없으면_예외가_발생한다() throws Exception {
        // given
        // when & then
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
    @DisplayName("필수 요청 값이 없으면 400 예외가 발생한다")
    void 필수_요청_값이_없으면_예외가_발생한다() throws Exception {
        // given
        OrganizationApiKeyCreateResponse apiKeyResponse = organizationApiKeyCreateService.create(
                1L,
                new OrganizationApiKeyCreateRequest("prod")
        );

        providerCredentialService.register(
                1L,
                new ProviderCredentialCreateRequest("openai", "provider-key")
        );

        // when & then
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
    @DisplayName("변수 값이 null이면 400 예외가 발생한다")
    void 변수_값이_null이면_예외가_발생한다() throws Exception {
        // given
        OrganizationApiKeyCreateResponse apiKeyResponse = organizationApiKeyCreateService.create(
                1L,
                new OrganizationApiKeyCreateRequest("prod")
        );

        // when & then
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
