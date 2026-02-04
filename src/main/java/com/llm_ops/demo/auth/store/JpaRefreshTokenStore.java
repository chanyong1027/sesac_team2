package com.llm_ops.demo.auth.store;

import com.llm_ops.demo.auth.domain.RefreshToken;
import com.llm_ops.demo.auth.repository.RefreshTokenRepository;
import com.llm_ops.demo.auth.util.TokenHashingUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Primary;
import org.springframework.security.crypto.password.PasswordEncoder;
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
    private final PasswordEncoder passwordEncoder;

    @Override
    public RefreshToken save(String token, Long userId, Instant expiryDate) {
        String tokenHash = passwordEncoder.encode(TokenHashingUtils.sha256Hex(token));
        RefreshToken refreshToken = RefreshToken.create(tokenHash, token, userId, expiryDate);
        return refreshTokenRepository.save(refreshToken);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<RefreshToken> findByUserId(Long userId) {
        return refreshTokenRepository.findByUserId(userId);
    }

    @Override
    public void deleteByUserId(Long userId) {
        refreshTokenRepository.deleteByUserId(userId);
    }
}
