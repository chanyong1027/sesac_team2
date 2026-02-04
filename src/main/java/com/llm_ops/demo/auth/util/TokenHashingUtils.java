package com.llm_ops.demo.auth.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

public final class TokenHashingUtils {

    private TokenHashingUtils() {
    }

    public static String sha256Hex(String value) {
        if (value == null) {
            throw new IllegalArgumentException("token is null");
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                builder.append(String.format("%02x", b));
            }
            return builder.toString();
        } catch (Exception ex) {
            throw new IllegalStateException("토큰 해시에 실패했습니다.", ex);
        }
    }
}
