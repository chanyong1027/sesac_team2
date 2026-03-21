package com.llm_ops.demo.support;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.junit.jupiter.api.Tag;

/**
 * PR 기본 게이트에서 제외하고 별도 워크플로우로 분리할 무거운 RAG 통합 테스트 태그입니다.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Tag("rag-heavy")
public @interface RagHeavyTest {
}
