package com.llm_ops.demo.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Getter
@Table(name = "console_user")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 50)
    private String email; // 로그인 아이디

    @Column(nullable = false, length = 50)
    private String name; // 이름

    @Column(nullable = false, length = 100) // 여기도 마찬가지로 해싱된 결과를 고려하여 길이 늘리기
    private String password; // 암호화된 비밀번호

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private Status status; // 접근 범위 권한인가?

    @CreationTimestamp
    private LocalDateTime createdAt;

    public Long getId() {
        return id;
    }

    private User(String email, String passwordHash, String name) {
        validateEmail(email);
        validateName(name);

        this.email = email;
        this.password = passwordHash;
        this.name = name;
        this.status = Status.ACTIVE;
        this.createdAt = LocalDateTime.now();
    }

    // 팩토리 메서드는 생성자 호출만
    public static User create(String email, String encodedPassword, String name) {
        return new User(email, encodedPassword, name);
    }

    // 검증 메서드
    private static void validateEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("이메일은 필수입니다.");
        }
    }

    private static void validateName(String name) {
        if (name == null || name.length() < 2) {
            throw new IllegalArgumentException("이름은 2자 이상이어야 합니다.");
        }
    }
}
