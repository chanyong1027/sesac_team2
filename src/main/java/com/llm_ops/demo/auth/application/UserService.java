package com.llm_ops.demo.auth.application;

import static com.llm_ops.demo.global.error.ErrorCode.INVALID_INPUT_VALUE;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.dto.request.SignUpRequest;
import com.llm_ops.demo.auth.dto.response.SignUpResponse;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.global.error.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public SignUpResponse signUp(SignUpRequest request) {
        // 1. 중복 검사
        validateDuplicate(request);

        // 2. 비밀번호 암호화
        String encodedPassword = passwordEncoder.encode(request.passwordHash());

        // 3. User 엔티티 생성 및 저장
        User user = User.of(request.userName(), encodedPassword, request.email());
        User savedUser = userRepository.save(user);

        return new SignUpResponse
                (
                        savedUser.getId(),
                        savedUser.getEmail(),
                        savedUser.getUserName(),
                        "회원가입이 완료되었습니다."
                );
    }

    private void validateDuplicate(SignUpRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new BusinessException(INVALID_INPUT_VALUE, "이미 사용 중인 이메일입니다.");
        }
    }
}
