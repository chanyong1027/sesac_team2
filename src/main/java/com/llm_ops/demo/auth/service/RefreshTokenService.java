package com.llm_ops.demo.auth.service;

import com.llm_ops.demo.auth.domain.RefreshToken;
import com.llm_ops.demo.auth.jwt.JwtTokenProvider;
import com.llm_ops.demo.auth.store.RefreshTokenStore;
import com.llm_ops.demo.global.error.BusinessException;
import com.llm_ops.demo.global.error.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@RequiredArgsConstructor
@Transactional
public class RefreshTokenService {

    private final RefreshTokenStore refreshTokenStore;
    private final JwtTokenProvider jwtTokenProvider;

    /**
     * 로그인 시: Refresh Token 생성 및 저장
     * 기존 토큰 삭제 후 새 토큰 발급 (단일 세션 정책)
     */
    public RefreshToken createAndSave(Long userId) {
        // 기존 토큰 삭제 (단일 세션 정책)
        refreshTokenStore.deleteByUserId(userId);

        // 새 토큰 생성 및 저장
        String token = jwtTokenProvider.createRefreshToken(userId);
        Instant expiryDate = Instant.now().plusSeconds(jwtTokenProvider.getRefreshExpirationSec());

        return refreshTokenStore.save(token, userId, expiryDate);
    }

    /**
     * 토큰 갱신 시: 검증 후 새 토큰 발급 (RT Rotate)
     */
    public RefreshToken rotateRefreshToken(String oldToken) {
        // 1. 토큰 존재 여부 확인 (화이트리스트)
        RefreshToken existingToken = refreshTokenStore.findByToken(oldToken)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHENTICATED,
                        "유효하지 않은 Refresh Token입니다."));

        // 2. 만료 여부 확인
        if (existingToken.isExpired()) {
            refreshTokenStore.deleteByToken(oldToken);
            throw new BusinessException(ErrorCode.UNAUTHENTICATED,
                    "만료된 Refresh Token입니다.");
        }

        // 3. RT Rotate (기존 토큰 삭제 후 새 토큰 발급)
        Long userId = existingToken.getUserId();
        return createAndSave(userId);
    }

    /**
     * 로그아웃 시: 사용자의 모든 Refresh Token 삭제
     */
    public void deleteByUserId(Long userId) {
        refreshTokenStore.deleteByUserId(userId);
    }
}
