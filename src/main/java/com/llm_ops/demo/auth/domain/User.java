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
import lombok.Getter;

@Entity
@Getter
@Table(name = "console_user")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 50)
    private String email; //로그인 아이디

    @Column(nullable = false, length = 50)
    private String userName;  // 이름

    @Column(nullable = false, length = 100) //여기도 마찬가지로 해싱된 결과를 고려하여 길이 늘리기
    private String passwordHash;  // 암호화된 비밀번호

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private Status status;  // 접근 범위 권한인가?

    @Column(nullable = false)
    private LocalDateTime createdAt;

    public static User of(String userName, String encodedPassword, String email) {
        User user = new User();
        user.email = email;
        user.userName = userName;
        user.passwordHash = encodedPassword;
        user.status = Status.ACTIVATE;
        user.createdAt = LocalDateTime.now();
        return user;
    }
}
