package com.llm_ops.demo.auth.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "refresh_tokens")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String token;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private Instant expiryDate;

    public static RefreshToken create(String token, Long userId, Instant expiryDate) {
        RefreshToken rt = new RefreshToken();
        rt.token = token;
        rt.userId = userId;
        rt.expiryDate = expiryDate;
        return rt;
    }

    public boolean isExpired() {
        return Instant.now().isAfter(expiryDate);
    }
}
