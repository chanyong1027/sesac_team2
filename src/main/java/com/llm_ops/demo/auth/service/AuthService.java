package com.llm_ops.demo.auth.service;

import com.llm_ops.demo.auth.domain.RefreshToken;
import com.llm_ops.demo.auth.domain.User;
import com.llm_ops.demo.auth.dto.request.LoginRequest;
import com.llm_ops.demo.auth.dto.request.SignUpRequest;
import com.llm_ops.demo.auth.dto.request.TokenRefreshRequest;
import com.llm_ops.demo.auth.dto.response.EmailAvailabilityResponse;
import com.llm_ops.demo.auth.dto.response.LoginResponse;
import com.llm_ops.demo.auth.dto.response.SignUpResponse;
import com.llm_ops.demo.auth.dto.response.TokenRefreshResponse;
import com.llm_ops.demo.auth.jwt.JwtTokenProvider;
import com.llm_ops.demo.auth.repository.UserRepository;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import com.llm_ops.demo.organization.domain.OrganizationMember;
import com.llm_ops.demo.organization.repository.OrganizationMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final OrganizationMemberRepository organizationMemberRepository;
    private final TokenBlacklistService tokenBlacklistService;
    private final RefreshTokenService refreshTokenService;

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

    @Transactional(readOnly = true)
    public EmailAvailabilityResponse checkEmailAvailability(String email) {
        boolean available = !userRepository.existsByEmail(email);
        String message = available ? "사용 가능한 이메일입니다." : "이미 사용 중인 이메일입니다.";
        return new EmailAvailabilityResponse(available, message);
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        // 1. 사용자 조회
        User user = userRepository.findByEmail(request.email()).orElseThrow(() -> new BusinessException(
                ErrorCode.UNAUTHENTICATED, "이메일 또는 비밀번호가 올바르지 않습니다."));

        // 2. 비밀번호 검증 (틀리면 C401)
        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new BusinessException(
                    ErrorCode.UNAUTHENTICATED,
                    "이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        // 3. Organization 정보 조회 (첫 번째 조직 사용)
        Long orgId = null;
        String orgRole = null;
        List<OrganizationMember> memberships = organizationMemberRepository.findByUser(user);
        if (!memberships.isEmpty()) {
            OrganizationMember membership = memberships.get(0);
            orgId = membership.getOrganization().getId();
            orgRole = membership.getRole().name();
        }

        // 4. JWT Access Token 생성
        String accessToken = jwtTokenProvider.createToken(user.getId(), orgId, orgRole);

        // 5. Refresh Token 생성 및 저장 (화이트리스트)
        RefreshToken refreshToken = refreshTokenService.createAndSave(user.getId());

        // 6. 응답 반환
        return new LoginResponse(
                accessToken,
                refreshToken.getToken(),
                "Bearer",
                jwtTokenProvider.getExpirationSec(),
                jwtTokenProvider.getRefreshExpirationSec());
    }

    public void logout(String accessToken) {
        // 1. Access Token에서 userId 추출
        Long userId = jwtTokenProvider.getUserIdFromToken(accessToken);

        // 2. Refresh Token 삭제 (화이트리스트에서 제거)
        refreshTokenService.deleteByUserId(userId);

        // 3. Access Token 블랙리스트 추가 (선택적)
        long remainingMillis = jwtTokenProvider.getRemainingExpirationInMillis(accessToken);
        if (remainingMillis > 0) {
            long expirationTime = System.currentTimeMillis() + remainingMillis;
            tokenBlacklistService.blacklistToken(accessToken, expirationTime);
        }
    }

    /**
     * Refresh Token으로 새 Access Token 발급 (RT Rotate)
     */
    @Transactional
    public TokenRefreshResponse refreshToken(TokenRefreshRequest request) {
        // 1. RT Rotate: 기존 토큰 검증 후 새 토큰 발급
        RefreshToken newRefreshToken = refreshTokenService.rotateRefreshToken(request.refreshToken());

        // 2. 사용자 조회
        User user = userRepository.findById(newRefreshToken.getUserId())
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHENTICATED));

        // 3. Organization 정보 조회
        Long orgId = null;
        String orgRole = null;
        List<OrganizationMember> memberships = organizationMemberRepository.findByUser(user);
        if (!memberships.isEmpty()) {
            OrganizationMember membership = memberships.get(0);
            orgId = membership.getOrganization().getId();
            orgRole = membership.getRole().name();
        }

        // 4. 새 Access Token 발급
        String newAccessToken = jwtTokenProvider.createToken(user.getId(), orgId, orgRole);

        return new TokenRefreshResponse(
                newAccessToken,
                newRefreshToken.getToken(),
                "Bearer",
                jwtTokenProvider.getExpirationSec(),
                jwtTokenProvider.getRefreshExpirationSec());
    }

    private void validateDuplicate(SignUpRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new BusinessException(ErrorCode.CONFLICT, "이미 사용 중인 이메일입니다."); // C409 에러
        }
    }
}
