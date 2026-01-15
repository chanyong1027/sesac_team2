package com.llm_ops.demo.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.dto.request.SignUpRequest;
import com.llm_ops.demo.auth.dto.response.SignUpResponse;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.global.error.BusinessException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @InjectMocks
    private UserService userService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Test
    @DisplayName("회원가입 성공")
    void signUp_Success() {
        // given
        SignUpRequest request = new SignUpRequest(
                "test@example.com",
                "Test1234!",
                "testuser");

        given(userRepository.existsByEmail(anyString())).willReturn(false);
        given(passwordEncoder.encode(anyString())).willReturn("encodedPassword");
        given(userRepository.save(any(User.class))).willAnswer(invocation -> {
            User user = invocation.getArgument(0);
            // ID 설정을 위한 리플렉션 (테스트용)
            var idField = User.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(user, 1L);
            return user;
        });

        // when
        SignUpResponse response = userService.signUp(request);

        // then
        assertThat(response.id()).isEqualTo(1L);
        assertThat(response.email()).isEqualTo("test@example.com");
        assertThat(response.userName()).isEqualTo("testuser");
        assertThat(response.message()).isEqualTo("회원가입이 완료되었습니다.");

        verify(userRepository).save(any(User.class));
    }

    @Test
    @DisplayName("중복 이메일로 회원가입 실패")
    void signUp_DuplicateEmail_ThrowsException() {
        // given
        SignUpRequest request = new SignUpRequest(
                "duplicate@example.com",
                "Test1234",
                "testuser");

        given(userRepository.existsByEmail("duplicate@example.com")).willReturn(true);

        // when & then
        assertThatThrownBy(() -> userService.signUp(request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("이미 사용 중인 이메일입니다.");
    }
}
