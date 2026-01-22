package com.llm_ops.demo.auth.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * 프로덕션 및 개발 환경(로컬 프로필 제외)에서 활성화되는 Spring Security 설정입니다.
 * JWT 기반 인증 및 인가 규칙을 정의하며, 로컬 환경의 완화된 설정과 분리됩니다.
 */
@Configuration
@EnableWebSecurity
@Profile("!local") // 'local' 프로필이 아닐 때만 이 SecurityConfig가 활성화됩니다.
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())  // REST API이므로 CSRF 비활성화
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // 인증 없이 접근 가능한 경로
                        .requestMatchers("/auth/**").permitAll()
                        .requestMatchers("/health").permitAll() // 개발 중 서버 상태 체크 -> claude가 제시해줌
                        // 그 외 모든 요청은 인증 필요
                        .anyRequest().authenticated()
                )
                // H2 Console을 위한 frameOptions 설정
                .headers(headers -> headers.frameOptions(frame -> frame.sameOrigin()));

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();  // BCrypt 사용
    }
}
