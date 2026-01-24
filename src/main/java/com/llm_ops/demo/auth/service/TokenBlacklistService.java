package com.llm_ops.demo.auth.service;

public interface TokenBlacklistService {

    void blacklistToken(String token, long expirationTimeInMillis);

    boolean isBlacklisted(String token);
}
