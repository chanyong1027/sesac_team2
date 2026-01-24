package com.llm_ops.demo.auth.config;

import com.llm_ops.demo.auth.jwt.JwtAuthenticationFilter;
import com.llm_ops.demo.auth.jwt.JwtTokenProvider;
import com.llm_ops.demo.auth.service.TokenBlacklistService;
import com.llm_ops.demo.auth.jwt.JwtAuthenticationEntryPoint;
import com.llm_ops.demo.auth.jwt.JwtAccessDeniedHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * 프로덕션 및 개발 환경(로컬 프로필 제외)에서 활성화되는 Spring Security 설정입니다.
 * JWT 기반 인증 및 인가 규칙을 정의하며, 로컬 환경의 완화된 설정과 분리됩니다.
 */
@Configuration
@EnableWebSecurity
@Profile("!local") // 'local' 프로필이 아닐 때만 이 SecurityConfig가 활성화됩니다.
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtTokenProvider jwtTokenProvider;
    private final TokenBlacklistService tokenBlacklistService;
    private final JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;
    private final JwtAccessDeniedHandler jwtAccessDeniedHandler;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())// REST API이므로 CSRF 비활성화
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // 인증 없이 접근 가능한 경로
                        .requestMatchers("/api/v1/auth/signup", "/api/v1/auth/login", "/api/v1/auth/refresh")
                        .permitAll()
                        .requestMatchers("/health").permitAll()
                        // 그 외 모든 요청(로그아웃 포함)은 인증 필요
                        .anyRequest().authenticated())
                // H2 Console을 위한 frameOptions 설정
                .headers(headers -> headers.frameOptions(frame -> frame.sameOrigin()))
                // JWT 인증 필터 추가
                // JWT 인증 필터 추가
                .addFilterBefore(new JwtAuthenticationFilter(jwtTokenProvider, tokenBlacklistService),
                        UsernamePasswordAuthenticationFilter.class)
                // 예외 처리 핸들러 등록
                .exceptionHandling(conf -> conf
                        .authenticationEntryPoint(jwtAuthenticationEntryPoint)
                        .accessDeniedHandler(jwtAccessDeniedHandler));

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(); // BCrypt 사용
    }
}
