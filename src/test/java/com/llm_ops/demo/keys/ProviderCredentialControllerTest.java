package com.llm_ops.demo.keys;

import com.llm_ops.demo.config.TestSecurityConfig;
import com.llm_ops.demo.keys.repository.ProviderCredentialRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"test", "mock-auth"})
@TestPropertySource(properties = "PROVIDER_KEY_ENC_KEY=test-secret")
@Import(TestSecurityConfig.class)
class ProviderCredentialControllerTest {
    // no-op: trigger commit for TODO progression

  @Autowired
  private WebApplicationContext context;

  @Autowired
  private ProviderCredentialRepository providerCredentialRepository;

  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc = webAppContextSetup(context).build();
    providerCredentialRepository.deleteAll();
  }

  @Test
  @DisplayName("Provider Key 등록 성공")
  void 프로바이더_키를_등록한다() throws Exception {
    // given
    mockMvc.perform(post("/api/v1/organizations/1/credentials")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
            {
              "provider": "openai",
              "apiKey": "test-key"
            }
            """))
        // when
        .andExpect(status().isCreated())
        // then
        .andExpect(jsonPath("$.credentialId").isNumber())
        .andExpect(jsonPath("$.provider").value("openai"))
        .andExpect(jsonPath("$.status").value("VERIFYING"))
        .andExpect(jsonPath("$.lastVerifiedAt").isEmpty())
        .andExpect(jsonPath("$.apiKey").doesNotExist());

    // then
    assertThat(providerCredentialRepository.count()).isEqualTo(1);
    String storedCiphertext = providerCredentialRepository.findAll().get(0).getKeyCiphertext();
    assertThat(storedCiphertext).isNotEqualTo("test-key");
  }

  @Test
  @DisplayName("Provider Key 중복 등록 시 409 반환")
  void 프로바이더_키가_중복되면_예외가_발생한다() throws Exception {
    // given
    mockMvc.perform(post("/api/v1/organizations/1/credentials")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
            {
              "provider": "openai",
              "apiKey": "test-key"
            }
            """))
        .andExpect(status().isCreated());

    // when
    mockMvc.perform(post("/api/v1/organizations/1/credentials")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
            {
              "provider": "openai",
              "apiKey": "another-key"
            }
            """))
        // then
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("C409"));
  }

  @Test
  @DisplayName("지원하지 않는 provider 입력 시 400 반환")
  void 지원하지_않는_프로바이더면_예외가_발생한다() throws Exception {
    // given
    // when
    mockMvc.perform(post("/api/v1/organizations/1/credentials")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
            {
              "provider": "invalid",
              "apiKey": "test-key"
            }
            """))
        // then
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("C400"));
  }

  @Test
  @DisplayName("apiKey 누락 시 400 반환")
  void apiKey가_비어있으면_예외가_발생한다() throws Exception {
    // given
    // when
    mockMvc.perform(post("/api/v1/organizations/1/credentials")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
            {
              "provider": "openai",
              "apiKey": ""
            }
            """))
        // then
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("C400"));
  }

  @Test
  @DisplayName("Provider Key 목록 조회 시 apiKey가 포함되지 않는다")
  void 프로바이더_키_목록을_조회하면_apiKey가_포함되지_않는다() throws Exception {
    // given
    mockMvc.perform(post("/api/v1/organizations/1/credentials")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
            {
              "provider": "openai",
              "apiKey": "test-key"
            }
            """))
        .andExpect(status().isCreated());

    // when
    mockMvc.perform(get("/api/v1/organizations/1/credentials"))
        // then
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].provider").value("openai"))
        .andExpect(jsonPath("$[0].status").value("VERIFYING"))
        .andExpect(jsonPath("$[0].apiKey").doesNotExist());
  }

  @Test
  @DisplayName("Provider Key 목록 조회 시 필드가 정상 매핑된다")
  void 프로바이더_키_목록을_조회한다() throws Exception {
    // given
    mockMvc.perform(post("/api/v1/organizations/1/credentials")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
            {
              "provider": "openai",
              "apiKey": "test-key"
            }
            """))
        .andExpect(status().isCreated());

    // when
    mockMvc.perform(get("/api/v1/organizations/1/credentials"))
        // then
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].provider").value("openai"))
        .andExpect(jsonPath("$[0].status").value("VERIFYING"))
        .andExpect(jsonPath("$[0].createdAt").isNotEmpty())
        .andExpect(jsonPath("$[0].lastVerifiedAt").isEmpty());
  }

  @Test
  @DisplayName("다른 조직의 Provider Key는 조회되지 않는다")
  void 다른_조직이면_프로바이더_키가_조회되지_않는다() throws Exception {
    // given
    mockMvc.perform(post("/api/v1/organizations/1/credentials")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
            {
              "provider": "openai",
              "apiKey": "test-key"
            }
            """))
        .andExpect(status().isCreated());

    // when
    mockMvc.perform(get("/api/v1/organizations/2/credentials"))
        // then
        .andExpect(status().isOk())
        .andExpect(jsonPath("$").isEmpty());
  }
}
