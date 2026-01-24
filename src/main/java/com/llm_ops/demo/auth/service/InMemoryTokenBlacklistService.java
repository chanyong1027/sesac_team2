package com.llm_ops.demo.auth.service;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class InMemoryTokenBlacklistService implements TokenBlacklistService {

    // 토큰과 만료 시간을 저장 (Key: Token, Value: Expiration Time in Millis)
    private final Map<String, Long> blacklist = new ConcurrentHashMap<>();

    // 토큰을 블랙리스트에 추가
    public void blacklistToken(String token, long expirationTimeInMillis) {
        blacklist.put(token, expirationTimeInMillis);
    }

    // 블랙리스트 포함 여부 확인
    public boolean isBlacklisted(String token) {
        // 1. 블랙리스트에 없으면 통과
        if (!blacklist.containsKey(token)) {
            return false;
        }

        // 2. 만료 시간이 지났으면 블랙리스트에서 제거 (메모리 정리)하고 통과
        // 사실 만료된 토큰은 JWT 검증 자체에서 걸러지므로, 여기서는 메모리 정리 목적이 큼
        if (System.currentTimeMillis() > blacklist.get(token)) {
            blacklist.remove(token);
            return false;
        }

        return true;
    }
}
