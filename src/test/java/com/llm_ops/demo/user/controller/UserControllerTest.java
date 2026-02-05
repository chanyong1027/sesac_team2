package com.llm_ops.demo.user.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.llm_ops.demo.auth.dto.request.SignUpRequest;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.config.TestSecurityConfig;
import com.llm_ops.demo.workspace.controller.InvitationAcceptController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
    }

    @Nested
    @DisplayName("내 정보 조회 테스트")
    class GetMeTest {

        @Test
        @DisplayName("내 정보 조회 성공 - 200 OK")
        void success() throws Exception {
            // given - 회원가입
            SignUpRequest signUpRequest = new SignUpRequest("user@example.com", "Test1234!", "testuser");
            mockMvc.perform(post("/api/v1/auth/signup")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(signUpRequest)))
                    .andExpect(status().isCreated());

            // given - 로그인
            String loginJson = """
                    {
                        "email": "user@example.com",
                        "password": "Test1234!"
                    }
                    """;
            String loginResponse = mockMvc.perform(post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(loginJson))
                    .andExpect(status().isOk())
                    .andReturn().getResponse().getContentAsString();

            String accessToken = objectMapper.readTree(loginResponse).path("data").path("accessToken").asText();

            // when
            mockMvc.perform(get("/api/v1/users/me")
                    .header("Authorization", "Bearer " + accessToken))
                    .andDo(print())
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code").value("COMMON_SUCCESS"))
                    .andExpect(jsonPath("$.data.email").value("user@example.com"))
                    .andExpect(jsonPath("$.data.name").value("testuser"))
                    .andExpect(jsonPath("$.data.status").value("ACTIVE"));
        }

        @Test
        @DisplayName("인증 없이 조회 실패 - 401 Unauthorized")
        void unauthenticated() throws Exception {
            // when & then
            mockMvc.perform(get("/api/v1/users/me"))
                    .andDo(print())
                    .andExpect(status().isUnauthorized());
        }
    }
}
