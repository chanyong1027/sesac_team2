package com.llm_ops.demo.auth.store;

import com.llm_ops.demo.auth.domain.RefreshToken;

import java.time.Instant;
import java.util.Optional;

/**
 * Refresh Token 저장소 인터페이스.
 * DB 또는 Redis 구현체로 교체 가능하도록 추상화.
 */
public interface RefreshTokenStore {

    /**
     * Refresh Token 저장
     */
    RefreshToken save(String token, Long userId, Instant expiryDate);

    /**
     * 토큰으로 조회
     */
    Optional<RefreshToken> findByToken(String token);

    /**
     * 토큰으로 삭제
     */
    void deleteByToken(String token);

    /**
     * 사용자 ID로 모든 토큰 삭제
     */
    void deleteByUserId(Long userId);
}
