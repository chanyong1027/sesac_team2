package com.llm_ops.demo.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.dto.request.LoginRequest;
import com.llm_ops.demo.auth.dto.request.SignUpRequest;
import com.llm_ops.demo.auth.dto.response.LoginResponse;
import com.llm_ops.demo.auth.dto.response.SignUpResponse;
import com.llm_ops.demo.auth.jwt.JwtTokenProvider;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.global.error.BusinessException;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @InjectMocks
    private AuthService authService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    // ==================== 회원가입 테스트 ====================
    @Nested
    @DisplayName("회원가입 테스트")
    class SignUpTest {

        @Test
        @DisplayName("회원가입 성공")
        void success() {
            // given
            SignUpRequest request = new SignUpRequest(
                    "test@example.com",
                    "Test1234!",
                    "testuser");

            given(userRepository.existsByEmail(anyString())).willReturn(false);
            given(passwordEncoder.encode(anyString())).willReturn("encodedPassword");
            given(userRepository.save(any(User.class))).willAnswer(invocation -> {
                User user = invocation.getArgument(0);
                var idField = User.class.getDeclaredField("id");
                idField.setAccessible(true);
                idField.set(user, 1L);
                return user;
            });

            // when
            SignUpResponse response = authService.signUp(request);

            // then
            assertThat(response.id()).isEqualTo(1L);
            assertThat(response.email()).isEqualTo("test@example.com");
            assertThat(response.userName()).isEqualTo("testuser");
            assertThat(response.message()).isEqualTo("회원가입이 완료되었습니다.");

            verify(userRepository).save(any(User.class));
        }

        @Test
        @DisplayName("중복 이메일로 회원가입 실패")
        void duplicateEmail_ThrowsException() {
            // given
            SignUpRequest request = new SignUpRequest(
                    "duplicate@example.com",
                    "Test1234",
                    "testuser");

            given(userRepository.existsByEmail("duplicate@example.com")).willReturn(true);

            // when & then
            assertThatThrownBy(() -> authService.signUp(request))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("이미 사용 중인 이메일입니다.");
        }
    }

    // ==================== 로그인 테스트 ====================
    @Nested
    @DisplayName("로그인 테스트")
    class LoginTest {

        @Test
        @DisplayName("로그인 성공")
        void success() {
            // given
            LoginRequest request = new LoginRequest("test@example.com", "Test1234!");

            User mockUser = User.create("test@example.com", "encodedPassword", "testuser");

            given(userRepository.findByEmail("test@example.com")).willReturn(Optional.of(mockUser));
            given(passwordEncoder.matches("Test1234!", "encodedPassword")).willReturn(true);
            given(jwtTokenProvider.createToken("test@example.com")).willReturn("mockJwtToken");
            given(jwtTokenProvider.getExpirationSec()).willReturn(900L);

            // when
            LoginResponse response = authService.login(request);

            // then
            assertThat(response.accessToken()).isEqualTo("mockJwtToken");
            assertThat(response.tokenType()).isEqualTo("Bearer");
            assertThat(response.expiresInSec()).isEqualTo(900L);
        }

        @Test
        @DisplayName("존재하지 않는 이메일로 로그인 실패")
        void emailNotFound_ThrowsException() {
            // given
            LoginRequest request = new LoginRequest("notexist@example.com", "Test1234!");

            given(userRepository.findByEmail("notexist@example.com")).willReturn(Optional.empty());

            // when & then
            assertThatThrownBy(() -> authService.login(request))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        @Test
        @DisplayName("틀린 비밀번호로 로그인 실패")
        void wrongPassword_ThrowsException() {
            // given
            LoginRequest request = new LoginRequest("test@example.com", "WrongPassword!");

            User mockUser = User.create("test@example.com", "encodedPassword", "testuser");

            given(userRepository.findByEmail("test@example.com")).willReturn(Optional.of(mockUser));
            given(passwordEncoder.matches("WrongPassword!", "encodedPassword")).willReturn(false);

            // when & then
            assertThatThrownBy(() -> authService.login(request))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("이메일 또는 비밀번호가 올바르지 않습니다.");
        }
    }
}
