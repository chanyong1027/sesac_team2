package com.llm_ops.demo.gateway.log.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.llm_ops.demo.gateway.log.domain.RequestLog;
import com.llm_ops.demo.gateway.log.domain.RequestLogStatus;
import com.llm_ops.demo.gateway.log.repository.RequestLogRepository;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * RequestLogWriter 통합 테스트.
 *
 * @Async + REQUIRES_NEW 트랜잭션 테스트를 위해 @Transactional 없이 실행.
 */
@SpringBootTest
@ActiveProfiles("test")
class RequestLogWriterTest {

        @Autowired
        private RequestLogWriter requestLogWriter;

        @Autowired
        private RequestLogRepository requestLogRepository;

        @AfterEach
        void cleanup() {
                requestLogRepository.deleteAll();
        }

        @Test
        void start_then_markSuccess_updatesStatusAndHttpFields() throws InterruptedException {
                UUID requestId = requestLogWriter.start(new RequestLogWriter.StartRequest(
                                null,
                                "trace-123",
                                10L,
                                20L,
                                30L,
                                "prefix-123",
                                "/v1/chat/completions",
                                "POST",
                                "prompt-key",
                                false));

                requestLogWriter.markSuccess(requestId, new RequestLogWriter.SuccessUpdate(
                                200,
                                123,
                                101L,
                                201L,
                                "openai",
                                "gpt-4o-mini",
                                "gpt-4o-mini",
                                false,
                                5,
                                7,
                                12,
                                new java.math.BigDecimal("0.00015"),
                                "v1.0.0",
                                50,
                                2,
                                1234,
                                true,
                                "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                                5,
                                0.7));

                // 비동기 처리 완료 대기
                Thread.sleep(1000);

                RequestLog saved = requestLogRepository.findById(requestId).orElseThrow();
                assertThat(saved.getStatus()).isEqualTo(RequestLogStatus.SUCCESS);
                assertThat(saved.getHttpStatus()).isEqualTo(200);
                assertThat(saved.getLatencyMs()).isEqualTo(123);
                assertThat(saved.getProvider()).isEqualTo("openai");
                assertThat(saved.getTotalTokens()).isEqualTo(12);
                assertThat(saved.getFinishedAt()).isNotNull();
                assertThat(saved.getApiKeyId()).isEqualTo(30L);
                assertThat(saved.getApiKeyPrefix()).isEqualTo("prefix-123");
                assertThat(saved.getPromptId()).isEqualTo(101L);
                assertThat(saved.getPromptVersionId()).isEqualTo(201L);
                assertThat(saved.getRagLatencyMs()).isEqualTo(50);
                assertThat(saved.getRagChunksCount()).isEqualTo(2);
                assertThat(saved.getRagContextChars()).isEqualTo(1234);
                assertThat(saved.getRagContextTruncated()).isTrue();
                assertThat(saved.getRagContextHash())
                                .isEqualTo("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
                assertThat(saved.getRagTopK()).isEqualTo(5);
                assertThat(saved.getRagSimilarityThreshold()).isEqualTo(0.7);
        }

        @Test
        void start_then_markFail_updatesStatusAndErrorFields() throws InterruptedException {
                UUID requestId = requestLogWriter.start(new RequestLogWriter.StartRequest(
                                null,
                                "trace-err",
                                10L,
                                20L,
                                30L,
                                "prefix-err",
                                "/v1/chat/completions",
                                "POST",
                                "prompt-key",
                                false));

                requestLogWriter.markFail(requestId, new RequestLogWriter.FailUpdate(
                                502,
                                999,
                                102L,
                                202L,
                                "openai",
                                "gpt-4o-mini",
                                "gpt-4o-mini",
                                false,
                                null,
                                null,
                                null,
                                null,
                                null,
                                "UPSTREAM_5XX",
                                "bad gateway",
                                "UPSTREAM_5XX",
                                77,
                                0,
                                0,
                                false,
                                null,
                                3,
                                0.5));

                // 비동기 처리 완료 대기
                Thread.sleep(1000);

                RequestLog saved = requestLogRepository.findById(requestId).orElseThrow();
                assertThat(saved.getStatus()).isEqualTo(RequestLogStatus.FAIL);
                assertThat(saved.getHttpStatus()).isEqualTo(502);
                assertThat(saved.getErrorCode()).isEqualTo("UPSTREAM_5XX");
                assertThat(saved.getFailReason()).isEqualTo("UPSTREAM_5XX");
                assertThat(saved.getFinishedAt()).isNotNull();
                assertThat(saved.getApiKeyId()).isEqualTo(30L);
                assertThat(saved.getApiKeyPrefix()).isEqualTo("prefix-err");
                assertThat(saved.getPromptId()).isEqualTo(102L);
                assertThat(saved.getPromptVersionId()).isEqualTo(202L);
                assertThat(saved.getRagLatencyMs()).isEqualTo(77);
                assertThat(saved.getRagChunksCount()).isEqualTo(0);
                assertThat(saved.getRagContextChars()).isEqualTo(0);
                assertThat(saved.getRagContextTruncated()).isFalse();
                assertThat(saved.getRagContextHash()).isNull();
        }
}

