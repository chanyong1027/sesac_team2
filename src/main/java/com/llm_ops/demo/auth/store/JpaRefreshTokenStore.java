package com.llm_ops.demo.auth.store;

import com.llm_ops.demo.auth.domain.RefreshToken;
import com.llm_ops.demo.auth.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

/**
 * JPA 기반 Refresh Token 저장소 구현체.
 * 나중에 RedisRefreshTokenStore로 교체 가능.
 */
@Primary
@Component
@RequiredArgsConstructor
@Transactional
public class JpaRefreshTokenStore implements RefreshTokenStore {

    private final RefreshTokenRepository refreshTokenRepository;

    @Override
    public RefreshToken save(String token, Long userId, Instant expiryDate) {
        RefreshToken refreshToken = RefreshToken.create(token, userId, expiryDate);
        return refreshTokenRepository.save(refreshToken);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<RefreshToken> findByToken(String token) {
        return refreshTokenRepository.findByToken(token);
    }

    @Override
    public void deleteByToken(String token) {
        refreshTokenRepository.deleteByToken(token);
    }

    @Override
    public void deleteByUserId(Long userId) {
        refreshTokenRepository.deleteByUserId(userId);
    }
}
