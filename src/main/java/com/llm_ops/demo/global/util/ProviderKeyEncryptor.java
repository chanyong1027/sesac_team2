package com.llm_ops.demo.global.util;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

@Component
public class ProviderKeyEncryptor {

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int IV_LENGTH = 12;
    private static final int TAG_LENGTH_BITS = 128;

    private final byte[] keyBytes;
    private final SecureRandom secureRandom = new SecureRandom();

    public ProviderKeyEncryptor(@Value("${PROVIDER_KEY_ENC_KEY}") String secret) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("PROVIDER_KEY_ENC_KEY is required");
        }
        this.keyBytes = deriveKey(secret);
    }

    public String encrypt(String plaintext) {
        try {
            byte[] initializationVector = new byte[IV_LENGTH];
            secureRandom.nextBytes(initializationVector);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            SecretKeySpec keySpec = new SecretKeySpec(keyBytes, "AES");
            GCMParameterSpec gcmSpec = new GCMParameterSpec(TAG_LENGTH_BITS, initializationVector);
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec);

            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            byte[] combined = new byte[initializationVector.length + ciphertext.length];
            System.arraycopy(initializationVector, 0, combined, 0, initializationVector.length);
            System.arraycopy(ciphertext, 0, combined, initializationVector.length, ciphertext.length);

            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to encrypt provider key", e);
        }
    }

    private byte[] deriveKey(String secret) {
        try {
            // Derive a 256-bit key from the provided secret for AES-GCM.
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return digest.digest(secret.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("Failed to derive encryption key", e);
        }
    }
}
