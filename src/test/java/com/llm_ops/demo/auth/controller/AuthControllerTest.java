package com.llm_ops.demo.auth.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.llm_ops.demo.auth.dto.request.SignUpRequest;
import com.llm_ops.demo.auth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthControllerTest {

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

        // ==================== 회원가입 테스트 ====================
        @Nested
        @DisplayName("회원가입 테스트")
        class SignUpTest {

                @Test
                @DisplayName("회원가입 성공 - 201 Created")
                void success() throws Exception {
                        // given
                        SignUpRequest request = new SignUpRequest(
                                        "test@example.com",
                                        "Test1234!",
                                        "testuser");

                        // when & then
                        mockMvc.perform(post("/auth/signup")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(objectMapper.writeValueAsString(request)))
                                        .andDo(print())
                                        .andExpect(status().isCreated())
                                        .andExpect(jsonPath("$.userName").value("testuser"))
                                        .andExpect(jsonPath("$.email").value("test@example.com"))
                                        .andExpect(jsonPath("$.message").value("회원가입이 완료되었습니다."));
                }

                @Test
                @DisplayName("중복 이메일 회원가입 - 409 Conflict")
                void duplicateEmail() throws Exception {
                        // given - 먼저 회원가입
                        SignUpRequest firstRequest = new SignUpRequest(
                                        "duplicate@example.com",
                                        "Test1234!",
                                        "firstuser");

                        mockMvc.perform(post("/auth/signup")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(objectMapper.writeValueAsString(firstRequest)))
                                        .andExpect(status().isCreated());

                        // when - 같은 이메일로 다시 가입 시도
                        SignUpRequest duplicateRequest = new SignUpRequest(
                                        "duplicate@example.com",
                                        "Test1234!",
                                        "seconduser");

                        // then
                        mockMvc.perform(post("/auth/signup")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(objectMapper.writeValueAsString(duplicateRequest)))
                                        .andDo(print())
                                        .andExpect(status().isConflict())
                                        .andExpect(jsonPath("$.message").value("이미 사용 중인 이메일입니다."));
                }

                @Test
                @DisplayName("유효성 검증 실패 - 비밀번호 8자 미만")
                void shortPassword() throws Exception {
                        // given
                        SignUpRequest request = new SignUpRequest(
                                        "test@example.com",
                                        "short1",
                                        "testuser");

                        // when & then
                        mockMvc.perform(post("/auth/signup")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(objectMapper.writeValueAsString(request)))
                                        .andDo(print())
                                        .andExpect(status().isBadRequest());
                }

                @Test
                @DisplayName("비밀번호 정책 위반1 - 숫자 없음")
                void passwordWithoutNumber() throws Exception {
                        // given
                        SignUpRequest request = new SignUpRequest(
                                        "test@example.com",
                                        "TestPassword",
                                        "testuser");

                        // when & then
                        mockMvc.perform(post("/auth/signup")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(objectMapper.writeValueAsString(request)))
                                        .andDo(print())
                                        .andExpect(status().isBadRequest());
                }

                @Test
                @DisplayName("비밀번호 정책 위반2 - 영문 없음")
                void passwordWithoutLetter() throws Exception {
                        // given
                        SignUpRequest request = new SignUpRequest(
                                        "test@example.com",
                                        "12345678",
                                        "testuser");

                        // when & then
                        mockMvc.perform(post("/auth/signup")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(objectMapper.writeValueAsString(request)))
                                        .andDo(print())
                                        .andExpect(status().isBadRequest());
                }

                @Test
                @DisplayName("비밀번호 정책 위반3 - 특수 기호 없음")
                void passwordWithoutSymbol() throws Exception {
                        // given
                        SignUpRequest request = new SignUpRequest(
                                        "test@example.com",
                                        "nosymbol123",
                                        "testuser");

                        // when & then
                        mockMvc.perform(post("/auth/signup")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(objectMapper.writeValueAsString(request)))
                                        .andDo(print())
                                        .andExpect(status().isBadRequest());
                }
        }

        // ==================== 로그인 테스트 ====================
        @Nested
        @DisplayName("로그인 테스트")
        class LoginTest {

                @Test
                @DisplayName("로그인 성공 - 200 OK")
                void success() throws Exception {
                        // given - 먼저 회원가입
                        SignUpRequest signUpRequest = new SignUpRequest(
                                        "login@example.com",
                                        "Test1234!",
                                        "loginuser");

                        mockMvc.perform(post("/auth/signup")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(objectMapper.writeValueAsString(signUpRequest)))
                                        .andExpect(status().isCreated());

                        // when - 로그인 요청
                        String loginJson = """
                                        {
                                            "email": "login@example.com",
                                            "password": "Test1234!"
                                        }
                                        """;

                        // then
                        mockMvc.perform(post("/auth/login")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(loginJson))
                                        .andDo(print())
                                        .andExpect(status().isOk())
                                        .andExpect(jsonPath("$.accessToken").exists())
                                        .andExpect(jsonPath("$.tokenType").value("Bearer"))
                                        .andExpect(jsonPath("$.expiresInSec").exists());
                }

                @Test
                @DisplayName("로그인 실패 - 틀린 비밀번호 401")
                void wrongPassword() throws Exception {
                        // given - 먼저 회원가입
                        SignUpRequest signUpRequest = new SignUpRequest(
                                        "wrong@example.com",
                                        "Test1234!",
                                        "testuser");

                        mockMvc.perform(post("/auth/signup")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(objectMapper.writeValueAsString(signUpRequest)))
                                        .andExpect(status().isCreated());

                        // when - 틀린 비밀번호로 로그인
                        String loginJson = """
                                        {
                                            "email": "wrong@example.com",
                                            "password": "WrongPassword!"
                                        }
                                        """;

                        // then
                        mockMvc.perform(post("/auth/login")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(loginJson))
                                        .andDo(print())
                                        .andExpect(status().isUnauthorized())
                                        .andExpect(jsonPath("$.message").value("이메일 또는 비밀번호가 올바르지 않습니다."));
                }

                @Test
                @DisplayName("로그인 실패 - 존재하지 않는 이메일 401")
                void emailNotFound() throws Exception {
                        // given - 회원가입하지 않은 이메일

                        // when
                        String loginJson = """
                                        {
                                            "email": "notexist@example.com",
                                            "password": "Test1234!"
                                        }
                                        """;

                        // then
                        mockMvc.perform(post("/auth/login")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(loginJson))
                                        .andDo(print())
                                        .andExpect(status().isUnauthorized())
                                        .andExpect(jsonPath("$.message").value("이메일 또는 비밀번호가 올바르지 않습니다."));
                }
        }
}