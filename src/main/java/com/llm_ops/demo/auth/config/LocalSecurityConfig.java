/*
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

*/
/**
 * 로컬 개발 환경(profile=local)에서만 활성화되는 Spring Security 설정입니다.
 * 개발 편의를 위해 CSRF 비활성화, 모든 요청 허용 등 완화된 보안 정책을 적용합니다.
 *//*

@Configuration
@EnableWebSecurity
@Profile("local")
public class LocalSecurityConfig {

    */
/**
     * 로컬 환경에 특화된 SecurityFilterChain을 구성합니다.
     * CSRF를 비활성화하고 모든 HTTP 요청을 인증 없이 허용합니다.
     *
     * @param http HttpSecurity 객체
     * @return 구성된 SecurityFilterChain
     * @throws Exception 보안 설정 중 발생할 수 있는 예외
     *//*

    @Bean
    public SecurityFilterChain localFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable()) // 로컬 개발 시 CSRF 보호 비활성화
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)) // 세션 관리 정책을 STATELESS로 설정
                .authorizeHttpRequests(auth -> auth
                        .anyRequest().permitAll() // 모든 요청을 인증 없이 허용
                )
                .headers(headers -> headers.frameOptions(frame -> frame.sameOrigin())); // 동일 출처의 프레임 허용 (예: H2 Console)

        return http.build();
    }

    */
/**
     * 비밀번호 인코딩을 위한 BCryptPasswordEncoder 빈을 제공합니다.
     *
     * @return BCryptPasswordEncoder 인스턴스
     *//*

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
*/
