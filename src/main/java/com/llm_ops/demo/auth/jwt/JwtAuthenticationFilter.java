package com.llm_ops.demo.auth.jwt;

import com.llm_ops.demo.auth.service.TokenBlacklistService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.List;

@Slf4j
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final TokenBlacklistService tokenBlacklistService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            String token = resolveToken(request);

            if (token != null && jwtTokenProvider.validateToken(token)) {
                // 블랙리스트 확인
                if (tokenBlacklistService.isBlacklisted(token)) {
                    log.warn("Blacklisted token detected: {}", token);
                    // 블랙리스트된 토큰은 인증 설정 안 함 -> 401/403 처리됨
                } else {
                    Long userId = jwtTokenProvider.getUserIdFromToken(token);
                    String orgRole = jwtTokenProvider.getOrgRoleFromToken(token);

                    // 권한 설정: orgRole이 있으면 ROLE_ 접두사 붙여서 등록
                    List<SimpleGrantedAuthority> authorities = (orgRole != null)
                            ? Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + orgRole))
                            : Collections.emptyList();

                    // Principal에 userId 저장 (컨트롤러에서 @AuthenticationPrincipal로 꺼내 쓸 수 있음)
                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(userId,
                            null, authorities);

                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }
        } catch (Exception e) {
            log.error("Could not set user authentication in security context", e);
        }

        filterChain.doFilter(request, response);
    }

    private String resolveToken(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
