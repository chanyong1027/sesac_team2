package com.llm_ops.demo.auth.jwt;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

@Slf4j
@Component
public class JwtTokenProvider {

    private static final String CLAIM_ORG_ID = "orgId";
    private static final String CLAIM_ORG_ROLE = "orgRole";

    private final long expirationSec;
    private final SecretKey key;

    public JwtTokenProvider(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration-sec}") long expirationSec) {
        this.expirationSec = expirationSec;
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
    }

    // 토큰 생성 - subject에 userId, claim에 organization 정보 포함
    public String createToken(Long userId, Long orgId, String orgRole) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationSec * 1000);

        var builder = Jwts.builder()
                .subject(String.valueOf(userId)) // 사용자 식별자 (userId)
                .issuedAt(now) // 발급 시간
                .expiration(expiry); // 만료 시간

        // organization 정보가 있으면 claim에 추가
        if (orgId != null) {
            builder.claim(CLAIM_ORG_ID, orgId);
        }
        if (orgRole != null) {
            builder.claim(CLAIM_ORG_ROLE, orgRole);
        }

        return builder.signWith(key).compact();
    }

    // userId 추출
    public Long getUserIdFromToken(String token) {
        Claims claims = parseClaims(token);
        return Long.valueOf(claims.getSubject());
    }

    // orgId 추출 (없으면 null 반환)
    public Long getOrgIdFromToken(String token) {
        Claims claims = parseClaims(token);
        Object orgId = claims.get(CLAIM_ORG_ID);
        return orgId != null ? ((Number) orgId).longValue() : null;
    }

    // orgRole 추출 (없으면 null 반환)
    public String getOrgRoleFromToken(String token) {
        Claims claims = parseClaims(token);
        return (String) claims.get(CLAIM_ORG_ROLE);
    }

    // 토큰 유효성 검증
    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (ExpiredJwtException e) {
            log.warn("만료된 JWT 토큰입니다.");
        } catch (JwtException e) {
            log.warn("유효하지 않은 JWT 토큰입니다: {}", e.getMessage());
        }
        return false;
    }

    // 만료 정보 반환
    public long getExpirationSec() {
        return expirationSec;
    }

    // 토큰의 남은 유효 시간(밀리초) 반환
    public long getRemainingExpirationInMillis(String token) {
        Claims claims = parseClaims(token);
        Date expiration = claims.getExpiration();
        long now = new Date().getTime();
        return expiration.getTime() - now;
    }

    // 토큰을 Claims로 변환
    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}