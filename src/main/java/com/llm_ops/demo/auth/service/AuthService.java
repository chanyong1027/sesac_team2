package com.llm_ops.demo.auth.service;

import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.dto.request.LoginRequest;
import com.llm_ops.demo.auth.dto.request.SignUpRequest;
import com.llm_ops.demo.auth.dto.response.LoginResponse;
import com.llm_ops.demo.auth.dto.response.SignUpResponse;
import com.llm_ops.demo.auth.jwt.JwtTokenProvider;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Transactional
    public SignUpResponse signUp(SignUpRequest request) {
        // 1. 중복 검사
        validateDuplicate(request);

        // 2. 비밀번호 암호화
        String encodedPassword = passwordEncoder.encode(request.password());

        // 3. User 엔티티 생성 및 저장
        User user = User.create(request.email(), encodedPassword, request.name());
        User savedUser = userRepository.save(user);

        return new SignUpResponse(
                savedUser.getId(),
                savedUser.getEmail(),
                savedUser.getName(),
                "회원가입이 완료되었습니다.");
    }

    @Transactional(readOnly = true) //lazy fetch를 통해 관련 없는 테이블 조회 방지
    public LoginResponse login(LoginRequest request) {
        // 사용자 조회
        User user = userRepository.findByEmail(request.email()).
                orElseThrow(() -> new BusinessException(
                        ErrorCode.UNAUTHENTICATED, "이메일 또는 비밀번호가 올바르지 않습니다."
                ));
        // 2. 비밀번호 검증 (틀리면 C401)
        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new BusinessException(
                    ErrorCode.UNAUTHENTICATED,
                    "이메일 또는 비밀번호가 올바르지 않습니다."
            );
        }
        // 3. JWT 토큰 생성
        String accessToken = jwtTokenProvider.createToken(user.getEmail());

        // 4. 응답 반환
        return new LoginResponse(
                accessToken,
                "Bearer",
                jwtTokenProvider.getExpirationSec()
        );
    }
    private void validateDuplicate(SignUpRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new BusinessException(ErrorCode.CONFLICT, "이미 사용 중인 이메일입니다."); // C409 에러
        }
    }


}
