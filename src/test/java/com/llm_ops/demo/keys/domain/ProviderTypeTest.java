package com.llm_ops.demo.keys.domain;

import com.llm_ops.demo.global.error.BusinessException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ProviderTypeTest {

    @Test
    void from_지원하는_프로바이더_별칭이면_정상_매핑된다() {
        // given
        // when & then
        assertEquals(ProviderType.OPENAI, ProviderType.from("openai"));
        assertEquals(ProviderType.ANTHROPIC, ProviderType.from("claude"));
        assertEquals(ProviderType.ANTHROPIC, ProviderType.from("anthropic"));
        assertEquals(ProviderType.GEMINI, ProviderType.from("gemini"));
        assertEquals(ProviderType.GEMINI, ProviderType.from("google"));
    }

    @Test
    void from_지원하지_않는_프로바이더면_예외가_발생한다() {
        // given
        // when & then
        assertThrows(BusinessException.class, () -> ProviderType.from("unknown"));
    }
}
