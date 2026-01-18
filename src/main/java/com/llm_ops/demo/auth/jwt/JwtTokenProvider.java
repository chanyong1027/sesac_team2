package com.llm_ops.demo.auth.jwt;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

@Slf4j
@Component
public class JwtTokenProvider {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration-sec}")
    private long expirationSec;

    private SecretKey key;

    @PostConstruct
    public void init() {
        // secret 문자열을 SecretKey로 변환
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
    }

    //토큰 생성
    public String createToken(String email) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationSec * 1000);

        return Jwts.builder()
                .subject(email)                    // 사용자 식별자
                .issuedAt(now)                     // 발급 시간
                .expiration(expiry)                // 만료 시간
                .signWith(key)                     // 서명
                .compact();
    }

    //이메일 추출
    public String getEmailFromToken(String token) {
        Claims claims = parseClaims(token);
        return claims.getSubject();
    }

    //토큰 유효성 검증
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

    //만료 정보 반환
    public long getExpirationSec() {
        return expirationSec;
    }

    //트큰을 Claims로 변환
    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}