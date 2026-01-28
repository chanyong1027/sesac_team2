package com.llm_ops.demo.keys;

import com.llm_ops.demo.config.TestSecurityConfig;
import com.llm_ops.demo.keys.repository.OrganizationApiKeyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
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
@Import(TestSecurityConfig.class)
class OrganizationApiKeyControllerTest {

  @Autowired
  private WebApplicationContext context;

  @Autowired
  private OrganizationApiKeyRepository organizationApiKeyRepository;

  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc = webAppContextSetup(context).build();
    organizationApiKeyRepository.deleteAll();
  }

  @Test
  @DisplayName("조직 외부 호출용 API 키 생성 시 apiKey 원문은 생성 응답에서만 제공된다")
  void api_키를_생성한다() throws Exception {
    // given
    // when
    mockMvc.perform(post("/api/v1/organizations/1/api-keys")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
            {
              "name": "prod"
            }
            """))
        // then
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.apiKey").isString());

    // then
    assertThat(organizationApiKeyRepository.count()).isEqualTo(1);
  }

  @Test
  @DisplayName("조직 외부 호출용 API 키 목록 조회 시 apiKey 원문은 포함되지 않는다")
  void api_키_목록을_조회하면_원문이_포함되지_않는다() throws Exception {
    // given
    mockMvc.perform(post("/api/v1/organizations/1/api-keys")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
            {
              "name": "prod"
            }
            """))
        .andExpect(status().isCreated());

    // when
    mockMvc.perform(get("/api/v1/organizations/1/api-keys"))
        // then
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].name").value("prod"))
        .andExpect(jsonPath("$[0].keyPrefix").isString())
        .andExpect(jsonPath("$[0].apiKey").doesNotExist());
  }
}
