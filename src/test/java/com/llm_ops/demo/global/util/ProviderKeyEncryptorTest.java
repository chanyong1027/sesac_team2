package com.llm_ops.demo.global.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ProviderKeyEncryptorTest {

    @Test
    void encryptThenDecrypt_암복호화가_정상적으로_동작한다() {
        // given
        ProviderKeyEncryptor encryptor = new ProviderKeyEncryptor("test-secret");

        // when
        String plaintext = "sk-test-123456";
        String ciphertext = encryptor.encrypt(plaintext);

        // then
        assertEquals(plaintext, encryptor.decrypt(ciphertext));
    }

    @Test
    void decrypt_암호문이_유효하지_않으면_예외가_발생한다() {
        // given
        ProviderKeyEncryptor encryptor = new ProviderKeyEncryptor("test-secret");

        // when & then
        assertThrows(IllegalStateException.class, () -> encryptor.decrypt("not-base64"));
    }
}
